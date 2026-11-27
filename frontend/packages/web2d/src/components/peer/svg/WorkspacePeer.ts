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
import ElementPeer, { formatLength } from './ElementPeer';
import type SizeType from '../../SizeType';
import type PositionType from '../../PositionType';
import { viewBoxMatrix, type Matrix } from '../../geometry/matrix';

/** The viewBox numbers: <min-x> <min-y> <width> <height>. */
type ViewBox = readonly [x: number, y: number, width: number, height: number];

type PanPreviewState = {
  persistent: boolean;
  logicalWidth: number;
  logicalHeight: number;
  logicalOriginX: number;
  logicalOriginY: number;
  logicalCoordWidth: number;
  logicalCoordHeight: number;
  scaleX: number;
  scaleY: number;
  marginPx: number;
  anchorDx: number;
  anchorDy: number;
  localDx: number;
  localDy: number;
  prevPosition: string;
  prevLeft: string;
  prevTop: string;
  prevWillChange: string;
};

class WorkspacePeer extends ElementPeer<SVGSVGElement> {
  private _panPreview: PanPreviewState | undefined;

  private _overscanMargin = 0;

  private _logicalWidth = 0;

  private _logicalHeight = 0;

  private _logicalViewBox: ViewBox = [0, 0, 0, 0];

  constructor() {
    super(ElementPeer.createNode('svg'));
    // The viewBox (the coordinate size and origin) stretches to the SVG size on both axes.
    this.attr('preserveAspectRatio', 'none');
  }

  /** The root <svg> is sized with its width and height attributes. */
  protected override hasSizeAttributes(): boolean {
    return true;
  }

  /**
   * The <svg> width and height attributes are the source of truth: a consumer may resize the SVG
   * around the peer (W-HTMLFONT, BL5-64). While an attribute still matches the kept size, the kept
   * value is returned, so its precision is not lost to the attribute format.
   */
  override getSize(): SizeType {
    if (this._panPreview) {
      return {
        width: this._panPreview.logicalWidth,
        height: this._panPreview.logicalHeight,
      };
    }
    if (this._overscanMargin > 0) {
      return {
        width: this._logicalWidth,
        height: this._logicalHeight,
      };
    }
    const { width, height } = super.getSize();
    return {
      width: this.sizeAttribute('width', width),
      height: this.sizeAttribute('height', height),
    };
  }

  override setSize(width?: number, height?: number): void {
    if (this._panPreview) {
      this.commitPanPreview();
    }
    if (this._overscanMargin > 0) {
      if (width !== undefined) {
        this._logicalWidth = width;
      }
      if (height !== undefined) {
        this._logicalHeight = height;
      }
      this.applyStaticOverscanDom();
      return;
    }
    super.setSize(width, height);
  }

  private sizeAttribute(name: 'width' | 'height', kept: number): number {
    const value = this._native.getAttribute(name);
    if (value === null || value === formatLength(kept)) {
      return kept;
    }
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? kept : parsed;
  }

  // The viewBox as numbers, and the attribute value they were parsed from or written as. A pan
  // reads and writes the origin, so it should not parse the string each time.
  private _viewBoxSource: string | undefined;

  private _viewBox: ViewBox | undefined;

  /**
   * The coordinate size and origin are the SVG viewBox: <min-x> <min-y> <width> <height> in user
   * units, mapped onto the whole <svg> (preserveAspectRatio="none").
   *
   * Values are kept at full precision: mindplot maps the mouse with the exact origin and
   * scale, so rounding them here makes slow pans stall and the mouse mapping drift.
   */
  setCoordSize(width: number, height: number): void {
    if (this._panPreview) {
      this.commitPanPreview();
    }
    if (this._overscanMargin > 0) {
      const [x, y] = this._logicalViewBox;
      this._logicalViewBox = [x, y, width, height];
      this.applyStaticOverscanDom();
      return;
    }
    const [x, y] = this.viewBox() ?? [0, 0, 0, 0];
    this.writeViewBox([x, y, width, height]);
  }

  getCoordSize(): SizeType {
    if (this._panPreview) {
      return {
        width: this._panPreview.logicalCoordWidth,
        height: this._panPreview.logicalCoordHeight,
      };
    }
    if (this._overscanMargin > 0) {
      return {
        width: this._logicalViewBox[2],
        height: this._logicalViewBox[3],
      };
    }
    const [, , width, height] = this.viewBox() ?? [1, 1, 1, 1];
    return { width, height };
  }

  setCoordOrigin(x: number, y: number): void {
    if (this._panPreview) {
      this.commitPanPreview();
    }
    if (this._overscanMargin > 0) {
      const [currentX, currentY, width, height] = this._logicalViewBox;
      this._logicalViewBox = [x ?? currentX, y ?? currentY, width, height];
      this.applyStaticOverscanDom();
      return;
    }
    // ViewBox min-x ,min-y by default initializated with 0 and 0.
    const [currentX, currentY, width, height] = this.viewBox() ?? [0, 0, 0, 0];
    this.writeViewBox([x ?? currentX, y ?? currentY, width, height]);
  }

  getCoordOrigin(): PositionType {
    if (this._panPreview) {
      const p = this._panPreview;
      return {
        x: p.logicalOriginX - p.localDx * p.scaleX,
        y: p.logicalOriginY - p.localDy * p.scaleY,
      };
    }
    if (this._overscanMargin > 0) {
      return {
        x: this._logicalViewBox[0],
        y: this._logicalViewBox[1],
      };
    }
    const [x, y] = this.viewBox() ?? [0, 0, 0, 0];
    return { x, y };
  }

  isPanPreviewActive(): boolean {
    return this._panPreview !== undefined;
  }

  setPanOverscanMargin(marginPx: number): void {
    const resolved = Number.isFinite(marginPx) && marginPx > 0 ? Math.round(marginPx) : 0;
    if (resolved === this._overscanMargin) {
      return;
    }
    if (this._panPreview) {
      this.commitPanPreview();
    }
    const { width, height } = this.getSize();
    const currentViewBox =
      this._overscanMargin > 0 ? this._logicalViewBox : (this.viewBox() ?? [0, 0, width, height]);
    this._logicalWidth = width;
    this._logicalHeight = height;
    this._logicalViewBox = currentViewBox;
    this._overscanMargin = resolved;

    if (resolved > 0) {
      this.applyStaticOverscanDom();
    } else {
      this._native.style.position = '';
      this._native.style.left = '';
      this._native.style.top = '';
      this._native.style.willChange = '';
      this._native.style.transform = '';
      super.setSize(this._logicalWidth, this._logicalHeight);
      this.writeViewBox(this._logicalViewBox);
    }
  }

  private applyStaticOverscanDom(): void {
    const marginPx = this._overscanMargin;
    if (marginPx <= 0) {
      return;
    }
    const width = this._logicalWidth;
    const height = this._logicalHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }
    const targetWidth = width + marginPx * 2;
    const targetHeight = height + marginPx * 2;
    const { width: currentWidth, height: currentHeight } = super.getSize();
    if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
      super.setSize(targetWidth, targetHeight);
    }
    if (this._native.style.position !== 'relative') {
      this._native.style.position = 'relative';
    }
    const offset = `${-marginPx}px`;
    if (this._native.style.left !== offset) {
      this._native.style.left = offset;
    }
    if (this._native.style.top !== offset) {
      this._native.style.top = offset;
    }
    if (this._native.style.willChange !== 'transform') {
      this._native.style.willChange = 'transform';
    }
    const [originX, originY, coordWidth, coordHeight] = this._logicalViewBox;
    if (
      Number.isFinite(coordWidth) &&
      Number.isFinite(coordHeight) &&
      coordWidth > 0 &&
      coordHeight > 0
    ) {
      this.writeOverscanViewBox(
        originX,
        originY,
        coordWidth,
        coordHeight,
        marginPx,
        coordWidth / width,
        coordHeight / height,
      );
    }
  }

  beginPanPreview(marginPx: number): boolean {
    if (this._panPreview) {
      return true;
    }
    const persistent = this._overscanMargin > 0;
    const effectiveMargin = persistent ? this._overscanMargin : marginPx;
    const { width: logicalWidth, height: logicalHeight } = this.getSize();
    const [logicalOriginX, logicalOriginY, logicalCoordWidth, logicalCoordHeight] = persistent
      ? this._logicalViewBox
      : (this.viewBox() ?? [0, 0, logicalWidth, logicalHeight]);
    if (
      !Number.isFinite(logicalWidth) ||
      !Number.isFinite(logicalHeight) ||
      logicalWidth <= 0 ||
      logicalHeight <= 0 ||
      !Number.isFinite(effectiveMargin) ||
      effectiveMargin <= 0 ||
      !Number.isFinite(logicalCoordWidth) ||
      !Number.isFinite(logicalCoordHeight) ||
      logicalCoordWidth <= 0 ||
      logicalCoordHeight <= 0
    ) {
      return false;
    }

    const scaleX = logicalCoordWidth / logicalWidth;
    const scaleY = logicalCoordHeight / logicalHeight;
    const prevPosition = this._native.style.position;
    const prevLeft = this._native.style.left;
    const prevTop = this._native.style.top;
    const prevWillChange = this._native.style.willChange;

    this._panPreview = {
      persistent,
      logicalWidth,
      logicalHeight,
      logicalOriginX,
      logicalOriginY,
      logicalCoordWidth,
      logicalCoordHeight,
      scaleX,
      scaleY,
      marginPx: effectiveMargin,
      anchorDx: 0,
      anchorDy: 0,
      localDx: 0,
      localDy: 0,
      prevPosition,
      prevLeft,
      prevTop,
      prevWillChange,
    };

    if (!persistent) {
      super.setSize(logicalWidth + effectiveMargin * 2, logicalHeight + effectiveMargin * 2);
      this._native.style.position = 'relative';
      this._native.style.left = `${-effectiveMargin}px`;
      this._native.style.top = `${-effectiveMargin}px`;
      this.writeOverscanViewBox(
        logicalOriginX,
        logicalOriginY,
        logicalCoordWidth,
        logicalCoordHeight,
        effectiveMargin,
        scaleX,
        scaleY,
      );
    }

    this._native.style.willChange = 'transform';
    this._native.style.transform = 'translate3d(0px, 0px, 0)';
    return true;
  }

  updatePanPreview(
    totalDx: number,
    totalDy: number,
  ): { localDx: number; localDy: number; reanchored: boolean } {
    const p = this._panPreview;
    if (!p) {
      return { localDx: 0, localDy: 0, reanchored: false };
    }
    const localDx = totalDx - p.anchorDx;
    const localDy = totalDy - p.anchorDy;
    if (Math.abs(localDx) >= p.marginPx || Math.abs(localDy) >= p.marginPx) {
      p.logicalOriginX -= localDx * p.scaleX;
      p.logicalOriginY -= localDy * p.scaleY;
      p.anchorDx = totalDx;
      p.anchorDy = totalDy;
      p.localDx = 0;
      p.localDy = 0;
      this.writeOverscanViewBox(
        p.logicalOriginX,
        p.logicalOriginY,
        p.logicalCoordWidth,
        p.logicalCoordHeight,
        p.marginPx,
        p.scaleX,
        p.scaleY,
      );
      this._native.style.transform = 'translate3d(0px, 0px, 0)';
      return { localDx: 0, localDy: 0, reanchored: true };
    }
    p.localDx = localDx;
    p.localDy = localDy;
    this._native.style.transform = `translate3d(${localDx}px, ${localDy}px, 0)`;
    return { localDx, localDy, reanchored: false };
  }

  commitPanPreview(): boolean {
    const p = this._panPreview;
    if (!p) {
      return false;
    }
    const finalOriginX = p.logicalOriginX - p.localDx * p.scaleX;
    const finalOriginY = p.logicalOriginY - p.localDy * p.scaleY;
    const {
      persistent,
      logicalWidth,
      logicalHeight,
      logicalCoordWidth,
      logicalCoordHeight,
      marginPx,
      scaleX,
      scaleY,
      localDx,
      localDy,
      prevPosition,
      prevLeft,
      prevTop,
      prevWillChange,
    } = p;

    this._panPreview = undefined;
    this._native.style.transform = '';

    if (persistent) {
      this._logicalViewBox = [finalOriginX, finalOriginY, logicalCoordWidth, logicalCoordHeight];
      if (localDx !== 0 || localDy !== 0) {
        this.writeOverscanViewBox(
          finalOriginX,
          finalOriginY,
          logicalCoordWidth,
          logicalCoordHeight,
          marginPx,
          scaleX,
          scaleY,
        );
      }
    } else {
      this._native.style.position = prevPosition;
      this._native.style.left = prevLeft;
      this._native.style.top = prevTop;
      this._native.style.willChange = prevWillChange;
      super.setSize(logicalWidth, logicalHeight);
      this.writeViewBox([finalOriginX, finalOriginY, logicalCoordWidth, logicalCoordHeight]);
    }
    return true;
  }

  private writeOverscanViewBox(
    logicalOriginX: number,
    logicalOriginY: number,
    logicalCoordWidth: number,
    logicalCoordHeight: number,
    marginPx: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const marginCoordX = marginPx * scaleX;
    const marginCoordY = marginPx * scaleY;
    this.writeViewBox([
      logicalOriginX - marginCoordX,
      logicalOriginY - marginCoordY,
      logicalCoordWidth + marginCoordX * 2,
      logicalCoordHeight + marginCoordY * 2,
    ]);
  }

  /**
   * The viewBox numbers, or undefined without a viewBox. The string is parsed only when it is not the
   * one last seen, for example after a write around the peer. A missing number is NaN.
   */
  private viewBox(): ViewBox | undefined {
    const viewBox = this._native.getAttribute('viewBox');
    if (viewBox === null) {
      return undefined;
    }
    if (viewBox !== this._viewBoxSource || !this._viewBox) {
      const [x = NaN, y = NaN, width = NaN, height = NaN] = viewBox
        .split(/ /)
        .map((e: string) => Number.parseFloat(e));
      this._viewBoxSource = viewBox;
      this._viewBox = [x, y, width, height];
    }
    return this._viewBox;
  }

  private writeViewBox(viewBox: ViewBox): void {
    const value = viewBox.join(' ');
    this.attr('viewBox', value);
    this._viewBoxSource = value;
    this._viewBox = viewBox;
  }

  getPosition(): PositionType {
    return { x: 0, y: 0 };
  }

  /**
   * The matrix from workspace coordinates (user units) to client (viewport) pixels: the browser's
   * getScreenCTM(), which accounts for the zoom (viewBox size), the pan (viewBox origin) and the
   * position of the <svg> on the page. Where it is missing or null (an <svg> that is not
   * rendered, an environment without layout), it is computed from the viewBox and the <svg>
   * bounding box, or its size when the box is empty.
   */
  getScreenMatrix(): Matrix {
    const ctm =
      typeof this._native.getScreenCTM === 'function'
        ? (this._native.getScreenCTM() ?? undefined)
        : undefined;
    if (ctm) {
      return ctm;
    }
    const rect = this._native.getBoundingClientRect();
    const { width, height } = rect.width > 0 && rect.height > 0 ? rect : this.getSize();
    const [x, y, viewBoxWidth, viewBoxHeight] = this.viewBox() ?? [0, 0, width, height];
    return viewBoxMatrix(
      { x, y, width: viewBoxWidth, height: viewBoxHeight },
      { x: rect.left, y: rect.top, width, height },
    );
  }
}

export default WorkspacePeer;
