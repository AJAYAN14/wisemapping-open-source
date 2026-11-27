/*
 *    Copyright [2007-2025] [wisemapping]
 *
 *   Licensed under WiseMapping Public License, Version 1.0 (the "License").
 *   It is basically the Apache License, Version 2.0 (the "License") plus the
 *   "powered by wisemapping" text requirement on every single page;
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the license at
 *
 *       https://github.com/wisemapping/wisemapping-open-source/blob/main/LICENSE.md
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
import { Workspace as Workspace2D, setImagePredecodePaused } from '@wisemapping/web2d';
import type {
  CustomEventMap,
  ElementEventListener,
  ElementClass,
  ElementPeer,
} from '@wisemapping/web2d';
import { $assert } from './util/assert';
import { isObjectTouch } from './util/objectTouch';
import { isContextMenuPress } from './util/platform';
import type ScreenManager from './ScreenManager';
import type SizeType from './SizeType';
import type CanvasElement from './CanvasElement';
import LayoutEventBus from './layout/LayoutEventBus';
import type PositionType from './PositionType';

const DEFAULT_VISIBILITY_PADDING = 80;
const VIEWPORT_CULL_STYLE_ID = 'wisemapping-viewport-cull-styles';

const ensureViewportCullStyles = (container: HTMLElement): void => {
  const root = container.getRootNode();
  const targetRoot = root instanceof ShadowRoot ? root : container.ownerDocument;
  if (!targetRoot || targetRoot.getElementById(VIEWPORT_CULL_STYLE_ID)) {
    return;
  }
  const style = (container.ownerDocument ?? document).createElement('style');
  style.id = VIEWPORT_CULL_STYLE_ID;
  style.textContent = '[data-viewport-culled="true"] { display: none !important; }';
  if (targetRoot instanceof ShadowRoot) {
    targetRoot.appendChild(style);
  } else if (targetRoot.head) {
    targetRoot.head.appendChild(style);
  } else {
    targetRoot.documentElement?.appendChild(style);
  }
};

/** Elements a map load adds to the canvas before it lets the browser paint (its spinner). */
const RENDER_QUEUE_BATCH = 300;

type BatchRenderable = CanvasElement & {
  prepareWorkspaceBatch: (workspace: Canvas) => void;
  measureTextForBatch: () => void;
  finishWorkspaceBatch: () => void;
};

const isBatchRenderable = (elem: unknown): elem is BatchRenderable =>
  Boolean(elem) &&
  typeof (elem as Partial<BatchRenderable>).prepareWorkspaceBatch === 'function' &&
  typeof (elem as Partial<BatchRenderable>).measureTextForBatch === 'function' &&
  typeof (elem as Partial<BatchRenderable>).finishWorkspaceBatch === 'function';

/** How long to wait for a paint where animation frames don't run (a hidden tab). */
const NO_FRAME_TIMEOUT = 100;
const VISIBILITY_PADDING_RATIO = 0.08;
const TOUCH_PAN_THRESHOLD_PX = 5;
const DEFERRED_PAN_COMMIT_IDLE_MS = 350;
export const CANVAS_ZOOM_RANGE = { min: 0.3, max: 7 } as const;
type BoundsType = { left: number; right: number; top: number; bottom: number };

class Canvas {
  private _zoom: number;

  private _screenManager: ScreenManager;

  private _isReadOnly: boolean;

  private _containerSize: SizeType;

  private _workspace: Workspace2D;

  private _eventsEnabled: boolean;

  private _renderQueue: (ElementClass<ElementPeer> | CanvasElement)[];

  private _queueRenderEnabled: boolean;

  private _mouseMoveListener: ((event: Event) => void) | undefined;

  private _mouseUpListener: (() => void) | undefined;

  // Ends the pan or pinch in progress without treating it as a release (window blur, dispose, long-press) ...
  private _cancelPan: (() => void) | undefined;

  private _cancelPinch: (() => void) | undefined;

  private _mouseDownListener: ((event: Event) => void) | undefined;

  private _flushDeferredPanCommit: ((emitEvents?: boolean) => void) | undefined;

  private _captureFlushListener: ((event: Event) => void) | undefined;

  // Stops observing the container size (registerEvents); undefined before or after.
  private _stopResizeObserver: (() => void) | undefined;

  private _resizeHandler: (() => void) | undefined;

  // Receives canvasPanned and canvasZoomed: the bus of the designer the canvas belongs to.
  private _layoutEventBus: LayoutEventBus;

  // Non-null while processRenderQueue is appending a batch so topics defer getBBox() layout reads.
  private _batchDeferredTopics: BatchRenderable[] | undefined;

  constructor(
    screenManager: ScreenManager,
    zoom: number,
    isReadOnly: boolean,
    delayRenderQueue: boolean,
    layoutEventBus: LayoutEventBus = new LayoutEventBus(),
  ) {
    // Create a suitable container ...
    $assert(screenManager, 'Div container can not be null');
    $assert(zoom, 'zoom container can not be null');

    this._zoom = zoom;
    this._screenManager = screenManager;
    this._layoutEventBus = layoutEventBus;
    this._isReadOnly = isReadOnly;

    const divContainer = screenManager.getContainer();
    ensureViewportCullStyles(divContainer);
    this._containerSize = {
      width: screenManager.getContainerWidth(),
      height: screenManager.getContainerHeight(),
    };
    // Initialize web2d workspace.
    const workspace = this._createWorkspace();
    this._workspace = workspace;

    // Append to the workspace...
    workspace.addItAsChildTo(divContainer);
    // Keep the SVG overscanned persistently so drag start/commit never triggers an SVG resize layout.
    const panWorkspace = workspace as Workspace2D & {
      setPanOverscan?: (enabled: boolean, marginPx?: number) => void;
    };
    if (typeof panWorkspace.setPanOverscan === 'function') {
      panWorkspace.setPanOverscan(true);
    }
    // Mouse positions map through the workspace screen matrix ...
    screenManager.setWorkspace(workspace);

    this.setZoom(zoom, true);
    this._renderQueue = [];
    this._eventsEnabled = false;
    this._queueRenderEnabled = delayRenderQueue;
    this._mouseMoveListener = undefined;
    this._mouseUpListener = undefined;
    this._cancelPan = undefined;
    this._cancelPinch = undefined;
    this._mouseDownListener = undefined;
    this._stopResizeObserver = undefined;
  }

  /** Fits the viewport to the container's new size, keeping the zoom and the centre of the view. */
  adjustToContainer(): void {
    this.setZoom(this._zoom, false);
  }

  /** Handles a container resize instead of adjustToContainer(), or undefined for the default. */
  setResizeHandler(handler: (() => void) | undefined): void {
    this._resizeHandler = handler;
  }

  registerEvents() {
    // Called on every map load: the listeners must be registered only once ...
    if (!this._mouseDownListener) {
      // Register drag events ...
      this._registerDragEvents();

      // Readjust when the container is resized: by the window, or by the page layout around it
      // (a side panel opening), which a window resize listener missed (BL5-143) ...
      this._stopResizeObserver = this._workspace.observeResize(() => {
        if (this._resizeHandler) {
          this._resizeHandler();
        } else {
          this.adjustToContainer();
        }
      }, this._screenManager.getContainer());
    }
    this._eventsEnabled = true;
  }

  /**
   * Removes the listeners registered on the container, the workspace and every shape in it, stops
   * observing the container size, ends any pan in progress, and removes the workspace SVG from the
   * container: a designer built again on it adds its own.
   */
  /**
   * Cancels any active canvas pan or pinch gesture without firing a background click or update.
   */
  cancelPan(): void {
    if (this._cancelPan) {
      this._cancelPan();
    }
    if (this._cancelPinch) {
      this._cancelPinch();
    }
  }

  dispose(): void {
    this.cancelPan();
    this._flushDeferredPanCommit?.(false);

    if (this._captureFlushListener) {
      const container = this._screenManager.getContainer();
      container.removeEventListener('mousedown', this._captureFlushListener, true);
      container.removeEventListener('wheel', this._captureFlushListener, true);
      window.document.removeEventListener('keydown', this._captureFlushListener, true);
      this._captureFlushListener = undefined;
    }

    if (this._stopResizeObserver) {
      this._stopResizeObserver();
      this._stopResizeObserver = undefined;
    }

    if (this._mouseDownListener) {
      this._screenManager.removeEvent('mousedown', this._mouseDownListener);
      this._screenManager.removeEvent('touchstart', this._mouseDownListener);
      this._mouseDownListener = undefined;
    }
    this._eventsEnabled = false;

    // Every listener added to the workspace and the shapes in it, in one go ...
    this._workspace.dispose();
    this._workspace._getHtmlContainer().remove();
    this._screenManager.setWorkspace(undefined);
  }

  isReadOnly(): boolean {
    return this._isReadOnly;
  }

  private _createWorkspace(): Workspace2D {
    // Initialize workspace ...
    const browserVisibleSize = this._screenManager.getVisibleBrowserSize();
    const coordOriginX = -(browserVisibleSize.width / 2);
    const coordOriginY = -(browserVisibleSize.height / 2);

    const workspaceProfile = {
      width: `${this._containerSize.width}px`,
      height: `${this._containerSize.height}px`,
      coordSizeWidth: browserVisibleSize.width,
      coordSizeHeight: browserVisibleSize.height,
      coordOriginX,
      coordOriginY,
      fillColor: 'transparent',
      strokeWidth: 0,
    };

    return new Workspace2D(workspaceProfile);
  }

  append(shape: ElementClass<ElementPeer> | CanvasElement): void {
    if (this._queueRenderEnabled) {
      this._renderQueue.push(shape);
    } else {
      this.appendInternal(shape);
    }
  }

  private appendInternal(shape: CanvasElement | ElementClass<ElementPeer>): void {
    if (typeof (shape as Partial<CanvasElement>).addToWorkspace === 'function') {
      (shape as CanvasElement).addToWorkspace(this);
    } else {
      this._workspace.append(shape as ElementClass<ElementPeer>);
    }
  }

  enableQueueRender(value: boolean): Promise<void> {
    this._queueRenderEnabled = value;

    let result = Promise.resolve();
    if (!value) {
      result = Canvas.afterNextPaint().then(() =>
        this.processRenderQueue(this._renderQueue.reverse(), RENDER_QUEUE_BATCH),
      );
    }
    return result;
  }

  /**
   * Resolves once the browser could paint: just after the next animation frame, or after a
   * timeout where frames don't run (a hidden tab, no requestAnimationFrame).
   *
   * A map load adds its elements in batches so that the page (the editor's loading spinner)
   * keeps painting. It used to wait 100 ms before the first batch and 30 ms after each one,
   * which made most of a load waiting; a frame is all a paint needs.
   */
  private static afterNextPaint(): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          resolve();
        }
      };
      const timeout = setTimeout(finish, NO_FRAME_TIMEOUT);
      if (typeof requestAnimationFrame === 'function') {
        // The frame callback runs before the paint: continue in the task after it.
        requestAnimationFrame(() => setTimeout(finish, 0));
      }
    });
  }

  /** True while processRenderQueue is collecting topics for deferred batch text measurement. */
  isDeferringBatchMeasure(): boolean {
    return this._batchDeferredTopics !== undefined;
  }

  /** Registers a topic prepared in Phase 1 so Phase 2/3 run after all batch DOM writes. */
  enqueueBatchMeasure(topic: CanvasElement): void {
    if (this._batchDeferredTopics && isBatchRenderable(topic)) {
      this._batchDeferredTopics.push(topic);
    }
  }

  /**
   * Adds the queued elements, a batch per paint, in the order they were queued (popped).
   * Topics added during the batch defer SVG text measurement until all elements in the batch
   * have written their text DOM nodes, reducing forced synchronous layouts to one per batch.
   */
  private processRenderQueue(
    renderQueue: (ElementClass<ElementPeer> | CanvasElement)[],
    batch: number,
  ): Promise<void> {
    const batchTopics: BatchRenderable[] = [];
    this._batchDeferredTopics = batchTopics;
    try {
      for (let i = 0; i < batch && renderQueue.length > 0; i++) {
        const elem = renderQueue.pop()!;
        this.appendInternal(elem);
      }
    } catch (e) {
      this._batchDeferredTopics = undefined;
      return Promise.reject(e);
    } finally {
      this._batchDeferredTopics = undefined;
    }

    try {
      for (const topic of batchTopics) {
        topic.measureTextForBatch();
      }
      for (const topic of batchTopics) {
        topic.finishWorkspaceBatch();
      }
    } catch (e) {
      return Promise.reject(e);
    }

    if (renderQueue.length === 0) {
      return Promise.resolve();
    }
    return Canvas.afterNextPaint().then(() => this.processRenderQueue(renderQueue, batch));
  }

  removeChild(shape: ElementClass<ElementPeer> | CanvasElement): void {
    if (typeof (shape as Partial<CanvasElement>).removeFromWorkspace === 'function') {
      (shape as CanvasElement).removeFromWorkspace(this);
    } else {
      this._workspace.removeChild(shape as ElementClass<ElementPeer>);
    }
  }

  /** Listens to the workspace: a native type gives its DOM event ('mousemove' a MouseEvent). */
  addEvent<K extends string>(type: K, listener: ElementEventListener<CustomEventMap, K>): void {
    this._workspace.addEvent(type, listener);
  }

  removeEvent<K extends string>(type: K, listener: ElementEventListener<CustomEventMap, K>): void {
    $assert(type, 'type can not be null');
    $assert(listener, 'listener can not be null');
    this._workspace.removeEvent(type, listener);
  }

  getSize(): SizeType {
    return this._workspace.getCoordSize();
  }

  setZoom(zoom: number, center = false): void {
    const workspace = this._workspace;

    const containerWidth = this._screenManager.getContainerWidth();
    const containerHeight = this._screenManager.getContainerHeight();
    const newVisibleAreaSize = { width: containerWidth, height: containerHeight };

    // - svg viewPort must fit container size with zoom adjustment
    const newCoordWidth = containerWidth * zoom;
    const newCoordHeight = containerHeight * zoom;

    let coordOriginX: number;
    let coordOriginY: number;
    if (center) {
      // Center and define a new center of coordinates ...
      coordOriginX = -(newVisibleAreaSize.width / 2) * zoom;
      coordOriginY = -(newVisibleAreaSize.height / 2) * zoom;
    } else {
      // Default behavior: Calculate the center of what the user actually sees in the workspace
      const oldCoordOrigin = workspace.getCoordOrigin();
      const oldCoordSize = workspace.getCoordSize();

      // The center of the visible area in workspace coordinates is:
      // The coordinate origin plus half the coordinate size (which represents the visible area)
      const visibleCenterX = oldCoordOrigin.x + oldCoordSize.width / 2;
      const visibleCenterY = oldCoordOrigin.y + oldCoordSize.height / 2;

      // Calculate new coordinate origin to keep this center point in the same place
      // after zoom change
      coordOriginX = visibleCenterX - newCoordWidth / 2;
      coordOriginY = visibleCenterY - newCoordHeight / 2;
    }

    this._applyViewport(zoom, coordOriginX, coordOriginY);
  }

  /**
   * Sets the zoom and pans so that `position` (in workspace coordinates) is drawn at
   * `screenPoint` (in pixels from the container's top-left corner).
   */
  setZoomAt(zoom: number, position: PositionType, screenPoint: PositionType): void {
    this._applyViewport(zoom, position.x - screenPoint.x * zoom, position.y - screenPoint.y * zoom);
  }

  /**
   * Zooms the canvas to `zoom` while keeping the workspace point under (`clientX`, `clientY`)
   * pinned at the same screen location. Returns false if the workspace cannot map client coordinates.
   */
  zoomAtClientPoint(zoom: number, clientX: number, clientY: number): boolean {
    const workspace = this._workspace as Workspace2D & {
      clientToWorld?: (x: number, y: number) => PositionType;
    };
    if (typeof workspace.clientToWorld !== 'function') {
      return false;
    }
    const container = this._screenManager.getContainer();
    const rect =
      typeof container.getBoundingClientRect === 'function'
        ? container.getBoundingClientRect()
        : { left: 0, top: 0 };
    const worldPos = workspace.clientToWorld(clientX, clientY);
    const screenPoint = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    this.setZoomAt(zoom, worldPos, screenPoint);
    return true;
  }

  /**
   * The one place the viewport changes zoom: the SVG fills the container, the viewBox is the
   * container scaled by `zoom` (workspace units per screen pixel), and the zoom kept here, the
   * screen manager's scale and the viewBox all agree.
   */
  private _applyViewport(zoom: number, coordOriginX: number, coordOriginY: number): void {
    this._flushDeferredPanCommit?.(false);
    const workspace = this._workspace;
    const containerWidth = this._screenManager.getContainerWidth();
    const containerHeight = this._screenManager.getContainerHeight();

    // - svg must fit container size. Go through the workspace so its size stays in sync: the inline
    // editor's font size is scaled by it (W-HTMLFONT).
    workspace.setSize(`${containerWidth}px`, `${containerHeight}px`);

    this._zoom = zoom;
    workspace.setCoordOrigin(coordOriginX, coordOriginY);
    workspace.setCoordSize(containerWidth * zoom, containerHeight * zoom);

    // Some changes in the screen. Let's fire an update event...
    this._screenManager.fireEvent('update');
    // Also fire LayoutEventBus event for canvas zooming
    this._layoutEventBus.fireEvent('canvasZoomed', { zoom });
  }

  getScreenManager(): ScreenManager {
    return this._screenManager;
  }

  setCoordOrigin(x: number, y: number): void {
    this._flushDeferredPanCommit?.(false);
    this._workspace.setCoordOrigin(x, y);
  }

  getCoordOrigin(): PositionType {
    return this._workspace.getCoordOrigin();
  }

  panBy(deltaX: number, deltaY: number): void {
    if (deltaX === 0 && deltaY === 0) return;
    this._flushDeferredPanCommit?.(false);
    const origin = this._workspace.getCoordOrigin();
    const newOriginX = origin.x + deltaX * this._zoom;
    const newOriginY = origin.y + deltaY * this._zoom;

    this._workspace.setCoordOrigin(newOriginX, newOriginY);
    this._screenManager.fireEvent('update');
    this._layoutEventBus.fireEvent('canvasPanned');
  }

  /**
   * Pans the canvas without firing 'update', so an active inline text editor stays open while
   * keeping the edited topic clear of the mobile virtual keyboard.
   */
  panForEditor(deltaX: number, deltaY: number): void {
    if (deltaX === 0 && deltaY === 0) return;
    this._flushDeferredPanCommit?.(false);
    const origin = this._workspace.getCoordOrigin();
    this._workspace.setCoordOrigin(origin.x + deltaX * this._zoom, origin.y + deltaY * this._zoom);
    this._layoutEventBus.fireEvent('canvasPanned');
  }

  setCoordSize(width: number, height: number): void {
    this._flushDeferredPanCommit?.(false);
    this._workspace.setCoordSize(width, height);
  }

  setZoomValue(zoom: number): void {
    this._zoom = zoom;
  }

  enableWorkspaceEvents(value: boolean) {
    this._eventsEnabled = value;
  }

  isWorkspaceEventsEnabled(): boolean {
    return this._eventsEnabled;
  }

  getSVGElement(): Element {
    return this._workspace.getSVGElement();
  }

  setBackgroundStyle(css: string): void {
    // A canvas that already left the page (disposed) has no container to style.
    const elem = this.getSVGElement().parentElement?.parentElement;
    elem?.setAttribute('style', css);
  }

  private _registerDragEvents() {
    const workspace = this._workspace as Workspace2D & {
      clientToWorld?: (x: number, y: number) => PositionType;
      beginPanPreview?: (marginPx?: number) => boolean;
      updatePanPreview?: (
        totalDx: number,
        totalDy: number,
      ) => { localDx: number; localDy: number; reanchored: boolean };
      commitPanPreview?: () => boolean;
    };
    const screenManager = this._screenManager;
    const mWorkspace = this;
    const panContainer = screenManager.getContainer();
    let panShield: HTMLDivElement | undefined;
    let deferredCommitTimer: ReturnType<typeof setTimeout> | undefined;
    let hasDeferredPan = false;
    // Use a single O(1) childless overlay shield instead of mutating body cursor or SVG
    // pointer-events, which would otherwise trigger inherited style recalc on every SVG child.
    const setPanShieldVisible = (visible: boolean) => {
      if (visible) {
        if (!panShield) {
          panShield = panContainer.ownerDocument.createElement('div');
          panShield.setAttribute('data-pan-shield', 'true');
          panShield.style.position = 'absolute';
          panShield.style.top = '0';
          panShield.style.right = '0';
          panShield.style.bottom = '0';
          panShield.style.left = '0';
          panShield.style.zIndex = '1000';
          panShield.style.cursor = 'move';
          panShield.style.background = 'transparent';
          panContainer.appendChild(panShield);
        }
        panShield.style.display = 'block';
      } else if (panShield) {
        panShield.style.display = 'none';
      }
    };

    const clearDeferredCommitTimer = () => {
      if (deferredCommitTimer !== undefined) {
        clearTimeout(deferredCommitTimer);
        deferredCommitTimer = undefined;
      }
    };

    const flushDeferredPanCommit = (emitEvents = true) => {
      clearDeferredCommitTimer();
      if (!hasDeferredPan) {
        return;
      }
      hasDeferredPan = false;
      if (typeof workspace.commitPanPreview === 'function') {
        workspace.commitPanPreview();
      }
      if (emitEvents) {
        this._layoutEventBus.fireEvent('canvasPanPreview', {
          active: false,
          dx: 0,
          dy: 0,
        });
        screenManager.fireEvent('update');
        this._layoutEventBus.fireEvent('canvasPanned');
      }
    };
    this._flushDeferredPanCommit = flushDeferredPanCommit;

    const captureFlushListener = (captureEvent: Event) => {
      if (!hasDeferredPan) {
        return;
      }
      if (captureEvent.type === 'mousedown') {
        const mouseEvt = captureEvent as MouseEvent;
        const button = mouseEvt.button ?? 0;
        // Middle-button pan or left-button pan on empty canvas keeps the deferred GPU preview.
        if (button === 1) {
          return;
        }
        const target = mouseEvt.target as Element | null;
        const svgEl = workspace.getSVGElement();
        const htmlContainer = workspace._getHtmlContainer();
        if (
          button === 0 &&
          (target === panContainer ||
            target === htmlContainer ||
            target === svgEl ||
            target === panShield)
        ) {
          return;
        }
      }
      flushDeferredPanCommit(true);
    };
    this._captureFlushListener = captureFlushListener;
    panContainer.addEventListener('mousedown', captureFlushListener, true);
    panContainer.addEventListener('wheel', captureFlushListener, true);
    window.document.addEventListener('keydown', captureFlushListener, true);
    let panUpdateScheduled = false;
    const schedulePanUpdate = () => {
      if (!panUpdateScheduled) {
        panUpdateScheduled = true;
        requestAnimationFrame(() => {
          this._layoutEventBus.fireEvent('canvasPanned');
          panUpdateScheduled = false;
        });
      }
    };

    const startPinch = (touchEvent: TouchEvent) => {
      if (this._cancelPan) {
        this._cancelPan();
      }
      if (this._cancelPinch) {
        this._cancelPinch();
      }
      if (!mWorkspace.isWorkspaceEventsEnabled()) {
        return;
      }

      const [t0, t1] = [touchEvent.touches[0]!, touchEvent.touches[1]!];
      const startDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const startMidX = (t0.clientX + t1.clientX) / 2;
      const startMidY = (t0.clientY + t1.clientY) / 2;
      const startZoom = this._zoom;
      const container = screenManager.getContainer();
      const rect =
        typeof container.getBoundingClientRect === 'function'
          ? container.getBoundingClientRect()
          : { left: 0, top: 0 };
      const anchorWorld =
        typeof workspace.clientToWorld === 'function'
          ? workspace.clientToWorld(startMidX, startMidY)
          : undefined;

      mWorkspace.enableWorkspaceEvents(false);

      const pinchMoveListener = (moveEvent: Event) => {
        const te = moveEvent as TouchEvent;
        if (!te.touches || te.touches.length < 2) {
          return;
        }
        const [p0, p1] = [te.touches[0]!, te.touches[1]!];
        const currDist = Math.hypot(p1.clientX - p0.clientX, p1.clientY - p0.clientY);
        const currMidX = (p0.clientX + p1.clientX) / 2;
        const currMidY = (p0.clientY + p1.clientY) / 2;

        let nextZoom = this._zoom;
        if (startDist > 5 && currDist > 5) {
          const rawZoom = startZoom * (startDist / currDist);
          nextZoom = Math.min(CANVAS_ZOOM_RANGE.max, Math.max(CANVAS_ZOOM_RANGE.min, rawZoom));
        }

        if (anchorWorld) {
          this.setZoomAt(nextZoom, anchorWorld, {
            x: currMidX - rect.left,
            y: currMidY - rect.top,
          });
        } else {
          this.setZoom(nextZoom, false);
        }

        te.preventDefault();
      };

      const endPinch = () => {
        screenManager.removeEvent('touchmove', pinchMoveListener);
        screenManager.removeEvent('touchend', pinchEndListener);
        screenManager.removeEvent('touchcancel', cancelPinch);
        window.removeEventListener('blur', cancelPinch);
        this._cancelPinch = undefined;
        mWorkspace.enableWorkspaceEvents(true);
      };

      const pinchEndListener = (endEvent: Event) => {
        const te = endEvent as TouchEvent;
        if (!te.touches || te.touches.length < 2) {
          endPinch();
        }
      };

      const cancelPinch = () => endPinch();
      this._cancelPinch = cancelPinch;

      screenManager.addEvent('touchmove', pinchMoveListener);
      screenManager.addEvent('touchend', pinchEndListener);
      screenManager.addEvent('touchcancel', cancelPinch);
      window.addEventListener('blur', cancelPinch);
      touchEvent.preventDefault();
    };

    const mouseDownListener = (event: Event) => {
      if (event.type === 'touchstart') {
        const touchEvent = event as TouchEvent;
        if (touchEvent.touches.length >= 2) {
          startPinch(touchEvent);
          return;
        }
      }

      if (!this._mouseMoveListener) {
        if (mWorkspace.isWorkspaceEventsEnabled()) {
          // The left button pans, and its release with no move is a click on the background. The
          // middle button pans too, but its release is no click. The right button, a Ctrl press
          // on a Mac (its right click) and the back and forward buttons do neither: they open a
          // menu or navigate, and must not move the map or lose the selection.
          let isPrimaryPress = true;
          if (event.type === 'mousedown') {
            const button = (event as MouseEvent).button ?? 0;
            if ((button !== 0 && button !== 1) || isContextMenuPress(event as MouseEvent)) {
              return;
            }
            isPrimaryPress = button === 0;
            if (button === 1) {
              // A middle press starts the browser's autoscroll (Chrome on Windows and Linux),
              // which would take the moves of the pan. A left press is left to the browser.
              event.preventDefault();
            }
          }

          mWorkspace.enableWorkspaceEvents(false);

          const originalEvent = event;
          // The pan follows the pointer in screen pixels, scaled by the zoom (workspace units per
          // pixel). Mapping each move to workspace coordinates would read them through the very
          // viewBox the pan is moving, so the canvas would lag behind the pointer.
          const mouseDownPosition = screenManager.getClientPosition(originalEvent as MouseEvent);
          const originalCoordOrigin = workspace.getCoordOrigin();

          // A tap on a topic or a relationship selects it through the mousedown the browser
          // emulates after the touch: its release is no click on the background.
          const isObjectTap = event.type === 'touchstart' && isObjectTouch(event);

          let wasDragged = false;
          let panInitialized = false;
          let usingPanPreview = false;
          let latestDeltaX = 0;
          let latestDeltaY = 0;
          let panRafId: number | undefined;

          const applyPendingPan = () => {
            panRafId = undefined;
            if (!panInitialized) {
              panInitialized = true;
              clearDeferredCommitTimer();
              setImagePredecodePaused(true);
              // Close any active inline text editor once when drag starts instead of on every mousemove.
              if (!hasDeferredPan) {
                screenManager.fireEvent('update');
              }
              setPanShieldVisible(true);
              usingPanPreview =
                typeof workspace.beginPanPreview === 'function' && workspace.beginPanPreview();
            }

            if (usingPanPreview && typeof workspace.updatePanPreview === 'function') {
              const { localDx, localDy, reanchored } = workspace.updatePanPreview(
                latestDeltaX,
                latestDeltaY,
              );
              this._layoutEventBus.fireEvent('canvasPanPreview', {
                active: true,
                dx: localDx,
                dy: localDy,
              });
              if (reanchored) {
                this._layoutEventBus.fireEvent('canvasPanned');
              }
              return;
            }

            const offsetX = latestDeltaX * this._zoom;
            const coordOriginX = -offsetX + originalCoordOrigin.x;

            const offsetY = latestDeltaY * this._zoom;
            const coordOriginY = -offsetY + originalCoordOrigin.y;

            workspace.setCoordOrigin(coordOriginX, coordOriginY);
            screenManager.fireEvent('update');
            schedulePanUpdate();
          };

          this._mouseMoveListener = (mouseMoveEvent: Event) => {
            if (mouseMoveEvent.type === 'touchmove') {
              const touchEvent = mouseMoveEvent as TouchEvent;
              if (touchEvent.touches.length >= 2) {
                startPinch(touchEvent);
                return;
              }
            }

            const currentMousePosition = screenManager.getClientPosition(
              mouseMoveEvent as MouseEvent,
            );

            const deltaX = currentMousePosition.x - mouseDownPosition.x;
            const deltaY = currentMousePosition.y - mouseDownPosition.y;

            if (
              !wasDragged &&
              mouseMoveEvent.type === 'touchmove' &&
              Math.hypot(deltaX, deltaY) < TOUCH_PAN_THRESHOLD_PX
            ) {
              mouseMoveEvent.preventDefault();
              return;
            }

            // Prevent default behavior for mouse and single-touch events synchronously
            // (pull-to-refresh and text selection during drag).
            if (mouseMoveEvent.type !== 'touchmove') {
              mouseMoveEvent.preventDefault();
            } else {
              const touchEvent = mouseMoveEvent as TouchEvent;
              if (touchEvent.touches.length === 1) {
                mouseMoveEvent.preventDefault();
              }
            }

            latestDeltaX = deltaX;
            latestDeltaY = deltaY;
            wasDragged = true;

            if (typeof requestAnimationFrame === 'function') {
              if (panRafId === undefined) {
                panRafId = requestAnimationFrame(applyPendingPan);
              }
            } else {
              applyPendingPan();
            }
          };
          // Mouse events are listened on the document, so that a release outside the container
          // still ends the pan. Touch events always go to the element the touch started on.
          window.document.addEventListener('mousemove', this._mouseMoveListener);
          screenManager.addEvent('touchmove', this._mouseMoveListener);

          const endPan = (isRelease: boolean) => {
            const hadPendingRaf = panRafId !== undefined;
            if (panRafId !== undefined && typeof cancelAnimationFrame === 'function') {
              cancelAnimationFrame(panRafId);
              panRafId = undefined;
            }
            // The listeners are all set together when the pan starts, before it can end.
            const mouseMoveListener = this._mouseMoveListener!;
            const mouseUpListener = this._mouseUpListener!;
            const cancelPan = this._cancelPan!;
            window.document.removeEventListener('mousemove', mouseMoveListener);
            window.document.removeEventListener('mouseup', mouseUpListener);
            screenManager.removeEvent('touchmove', mouseMoveListener);
            screenManager.removeEvent('touchend', mouseUpListener);
            screenManager.removeEvent('touchcancel', cancelPan);
            window.removeEventListener('blur', cancelPan);
            this._mouseUpListener = undefined;
            this._mouseMoveListener = undefined;
            this._cancelPan = undefined;
            setPanShieldVisible(false);
            setImagePredecodePaused(false);

            if (wasDragged) {
              if (
                usingPanPreview &&
                typeof workspace.updatePanPreview === 'function' &&
                typeof workspace.commitPanPreview === 'function'
              ) {
                const { localDx, localDy, reanchored } = workspace.updatePanPreview(
                  latestDeltaX,
                  latestDeltaY,
                );
                this._layoutEventBus.fireEvent('canvasPanPreview', {
                  active: true,
                  dx: localDx,
                  dy: localDy,
                });
                if (reanchored) {
                  this._layoutEventBus.fireEvent('canvasPanned');
                }
                hasDeferredPan = true;
                if (!isRelease) {
                  flushDeferredPanCommit(true);
                } else {
                  clearDeferredCommitTimer();
                  deferredCommitTimer = setTimeout(() => {
                    flushDeferredPanCommit(true);
                  }, DEFERRED_PAN_COMMIT_IDLE_MS);
                }
              } else if (hadPendingRaf || !panInitialized) {
                const offsetX = latestDeltaX * this._zoom;
                const offsetY = latestDeltaY * this._zoom;
                workspace.setCoordOrigin(
                  -offsetX + originalCoordOrigin.x,
                  -offsetY + originalCoordOrigin.y,
                );
                screenManager.fireEvent('update');
                this._layoutEventBus.fireEvent('canvasPanned');
              }
            }

            mWorkspace.enableWorkspaceEvents(true);

            if (isRelease && !wasDragged && !isObjectTap && isPrimaryPress) {
              // With the modifiers of the press: a Ctrl or Cmd click keeps the selection.
              screenManager.fireEvent('click', originalEvent as UIEvent);
            }
          };
          // The button can be released where no mouseup reaches the page (another window) ...
          this._cancelPan = () => endPan(false);

          // Register mouse up listeners ...
          this._mouseUpListener = () => endPan(true);
          window.document.addEventListener('mouseup', this._mouseUpListener);
          screenManager.addEvent('touchend', this._mouseUpListener);
          screenManager.addEvent('touchcancel', this._cancelPan);
          window.addEventListener('blur', this._cancelPan);
        }
      } else {
        // A press while a pan is in progress (the release never reached the page, or a second
        // button or finger): end the pan, but it is not a release, so it must not fire a click.
        this._cancelPan!();
      }
    };
    this._mouseDownListener = mouseDownListener;
    screenManager.addEvent('mousedown', mouseDownListener);
    screenManager.addEvent('touchstart', mouseDownListener);
  }

  ensureVisible(bounds: BoundsType, minPadding = DEFAULT_VISIBILITY_PADDING): boolean {
    this._flushDeferredPanCommit?.(false);
    const workspace = this._workspace;
    const origin = workspace.getCoordOrigin();
    const coordSize = workspace.getCoordSize();

    const computePadding = (length: number) => {
      const relativePadding = length * VISIBILITY_PADDING_RATIO;
      const desiredPadding = Math.max(relativePadding, minPadding);
      return Math.min(desiredPadding, length / 2);
    };

    const paddingX = computePadding(coordSize.width);
    const paddingY = computePadding(coordSize.height);

    const viewLeft = origin.x;
    const viewTop = origin.y;
    const viewRight = origin.x + coordSize.width;
    const viewBottom = origin.y + coordSize.height;

    const paddedLeft = viewLeft + paddingX;
    const paddedRight = viewRight - paddingX;
    const paddedTop = viewTop + paddingY;
    const paddedBottom = viewBottom - paddingY;

    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;

    const needsBothHorizontal = bounds.left < paddedLeft && bounds.right > paddedRight;
    const needsBothVertical = bounds.top < paddedTop && bounds.bottom > paddedBottom;

    let newOriginX = origin.x;
    if (needsBothHorizontal) {
      newOriginX = centerX - coordSize.width / 2;
    } else if (bounds.right > paddedRight) {
      newOriginX += bounds.right - paddedRight;
    } else if (bounds.left < paddedLeft) {
      newOriginX += bounds.left - paddedLeft;
    }

    let newOriginY = origin.y;
    if (needsBothVertical) {
      newOriginY = centerY - coordSize.height / 2;
    } else if (bounds.bottom > paddedBottom) {
      newOriginY += bounds.bottom - paddedBottom;
    } else if (bounds.top < paddedTop) {
      newOriginY += bounds.top - paddedTop;
    }

    if (newOriginX !== origin.x || newOriginY !== origin.y) {
      workspace.setCoordOrigin(newOriginX, newOriginY);
      this._screenManager.fireEvent('update');
      this._layoutEventBus.fireEvent('canvasPanned');
      return true;
    }
    return false;
  }

  /**
   * Pans the viewport so `position` (in workspace coordinates) sits exactly at
   * the centre of the visible area.
   *
   * This is the unconditional counterpart of `ensureVisible()`: that method only
   * pans when the bounds fall outside the padded viewport and then moves by the
   * smallest amount that brings them back in, which is the right behaviour for
   * keyboard navigation. Revealing a deep-linked node instead wants the node
   * parked in the middle of the screen regardless of where it already was.
   *
   * Returns true when the viewport actually moved.
   */
  centerOnPosition(position: PositionType): boolean {
    this._flushDeferredPanCommit?.(false);
    const workspace = this._workspace;
    const coordSize = workspace.getCoordSize();
    const origin = workspace.getCoordOrigin();

    const newOriginX = position.x - coordSize.width / 2;
    const newOriginY = position.y - coordSize.height / 2;
    if (newOriginX === origin.x && newOriginY === origin.y) {
      return false;
    }

    workspace.setCoordOrigin(newOriginX, newOriginY);
    this._screenManager.fireEvent('update');
    this._layoutEventBus.fireEvent('canvasPanned');
    return true;
  }

  getZoom() {
    return this._zoom;
  }
}

export default Canvas;
