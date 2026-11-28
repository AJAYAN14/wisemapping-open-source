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

import type ScreenManager from './ScreenManager';
import type Topic from './Topic';
import type Designer from './Designer';
import ColorUtil from './theme/ColorUtil';
import { $msg } from './Messages';
import type { LayoutEventPayloads } from './layout/LayoutEventBus';
import type { LayoutEventBusType } from './LayoutEventBusType';
import type NodeModel from './model/NodeModel';

/**
 * Stacking layer for the canvas affordances appended straight to the container
 * (the create-child plus buttons), rather than into `_overlayContainer`.
 *
 * Those are siblings of the SVG in the root stacking context, so their z-index
 * competes with the editor's floating chrome -- toolbars and the panes they
 * open. It has to stay below the editor's lowest chrome layer (1000), or a plus
 * button paints over an open toolbar pane: a toolbar is a positioned element
 * with a z-index of its own, so a pane portalled inside one is clamped to the
 * toolbar's layer no matter how high the pane's own z-index is.
 */
const CANVAS_AFFORDANCE_Z_INDEX = '999';
const SELECTION_STYLE_ID = 'wisemapping-topic-selection-styles';

const ensureSelectionStyles = (container: HTMLElement): void => {
  const root = container.getRootNode();
  const targetRoot = root instanceof ShadowRoot ? root : container.ownerDocument;
  if (!targetRoot || targetRoot.getElementById(SELECTION_STYLE_ID)) {
    return;
  }

  const style = (container.ownerDocument ?? document).createElement('style');
  style.id = SELECTION_STYLE_ID;
  style.textContent = `
    .wise-topic-selection-pill,
    .wise-topic-image-preview,
    .wise-topic-more-actions {
      appearance: none;
      -webkit-appearance: none;
    }
    .wise-topic-selection-pill::after,
    .wise-topic-image-preview::after,
    .wise-topic-more-actions::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 100%;
      height: 100%;
      min-width: calc(24px / var(--wise-pill-scale, 1));
      min-height: calc(24px / var(--wise-pill-scale, 1));
    }
    @media (pointer: coarse) {
      .wise-topic-selection-pill::after,
      .wise-topic-image-preview::after,
      .wise-topic-more-actions::after {
        min-width: calc(44px / var(--wise-pill-scale, 1));
        min-height: calc(44px / var(--wise-pill-scale, 1));
      }
    }
    .wise-topic-selection-pill:focus-visible,
    .wise-topic-image-preview:focus-visible,
    .wise-topic-more-actions:focus-visible {
      outline: 2px solid #0284c7;
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .wise-topic-selection-pill,
      .wise-topic-image-preview,
      .wise-topic-more-actions {
        transition: none !important;
      }
    }
    @media (forced-colors: active) {
      .wise-topic-selection-overlay {
        outline: 2px solid Highlight;
        outline-offset: 1px;
      }
      .wise-topic-selection-pill,
      .wise-topic-image-preview,
      .wise-topic-more-actions {
        border-color: ButtonText !important;
      }
      .wise-topic-selection-pill:focus-visible,
      .wise-topic-image-preview:focus-visible,
      .wise-topic-more-actions:focus-visible {
        outline: 2px solid Highlight;
      }
    }
  `;
  if (targetRoot instanceof ShadowRoot) {
    targetRoot.appendChild(style);
  } else if (targetRoot.head) {
    targetRoot.head.appendChild(style);
  } else {
    targetRoot.documentElement?.appendChild(style);
  }
};

type Unsubscribe = () => void;

/** LayoutEventBus registration made by initializeSelectionShadows, per designer. */
const unsubscribeByDesigner = new WeakMap<Designer, Unsubscribe>();

type PillVisualState = {
  badge: HTMLSpanElement;
  labelSpan: HTMLSpanElement;
  kbdSpan: HTMLSpanElement;
  badgeBaseColor?: string;
  badgeHoverColor?: string;
  pillBaseBg?: string;
  pillHoverBg?: string;
  pillBaseBorder?: string;
  pillHoverBorder?: string;
};

type ActionPillElement = HTMLButtonElement & {
  _pillState?: PillVisualState;
  _baseColor?: string;
  _hoverColor?: string;
};

type OverlayGeometry = {
  overlayLeft: number;
  overlayTop: number;
  overlayWidth: number;
  overlayHeight: number;
  overlayRight: number;
  topicLeft: number;
  topicTop: number;
  topicRight: number;
  topicBottom: number;
  topicCenterX: number;
  topicCenterY: number;
  isOnLeft: boolean;
};

const MOBILE_USER_AGENT_REGEX = new RegExp(
  '(android|bb\\d+|meego).+mobile|avantgo|bada\\/|blackberry|blazer|compal|elaine|fennec|' +
    'hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|' +
    'opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\\/|plucker|pocket|psp|series(4|6)0|symbian|' +
    'treo|up\\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino',
  'i',
);

const isTouchOrMobileDevice = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const hasMatchMedia = typeof window.matchMedia === 'function';
  if (hasMatchMedia && window.matchMedia('(pointer: coarse)').matches) {
    return true;
  }
  const hasAnyCoarseOnly =
    hasMatchMedia &&
    window.matchMedia('(any-pointer: coarse)').matches &&
    !window.matchMedia('(any-pointer: fine)').matches;
  if (hasAnyCoarseOnly) {
    return true;
  }
  const hasTouchNarrowViewport =
    hasMatchMedia &&
    window.matchMedia('(max-width: 899.95px)').matches &&
    ((typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || 'ontouchstart' in window);
  if (hasTouchNarrowViewport) {
    return true;
  }
  if (typeof navigator !== 'undefined' && MOBILE_USER_AGENT_REGEX.test(navigator.userAgent)) {
    return true;
  }
  return false;
};

class HTMLTopicSelected {
  private _overlayContainer: HTMLDivElement | undefined;

  private _pillsContainer: HTMLDivElement | undefined;

  private _overlay: HTMLDivElement | undefined;

  private _rightPlus: ActionPillElement | undefined;

  private _bottomPlus: ActionPillElement | undefined;

  private _imagePreviewButton: HTMLButtonElement | undefined;

  private _moreActionsButton: ActionPillElement | undefined;

  private _screenManager: ScreenManager;

  private _containerElement: HTMLDivElement;

  private _isVisible: boolean;

  private _topic: Topic;

  private _onTopicFocus: (() => void) | undefined;

  private _onTopicBlur: (() => void) | undefined;

  constructor(topic: Topic, containerElement: HTMLDivElement, screenManager: ScreenManager) {
    this._topic = topic;
    this._containerElement = containerElement;
    this._screenManager = screenManager;
    this._isVisible = false;
    ensureSelectionStyles(containerElement);

    // Create overlay container - insert it first so it's behind SVG
    this._overlayContainer = document.createElement('div');
    this._overlayContainer.style.position = 'absolute';
    this._overlayContainer.style.top = '0';
    this._overlayContainer.style.left = '0';
    this._overlayContainer.style.width = '100%';
    this._overlayContainer.style.height = '100%';
    // Keep pointerEvents none on container - buttons will be appended to main container instead
    this._overlayContainer.style.pointerEvents = 'none';
    this._overlayContainer.style.zIndex = '0';
    this._overlayContainer.style.overflow = 'visible';
    containerElement.insertBefore(this._overlayContainer, containerElement.firstChild);

    // Create overlay for the topic
    this._overlay = document.createElement('div');
    this._overlay.className = 'wise-topic-selection-overlay';
    this._overlay.style.position = 'absolute';
    // Keep border inside overlayWidth/Height so selection wraps symmetrically on all 4 sides.
    this._overlay.style.boxSizing = 'border-box';
    // Colors will be set by updateColors() method
    this._overlay.style.pointerEvents = 'none'; // Overlay itself doesn't capture clicks
    this._overlay.style.display = 'none'; // Hidden by default
    this._overlay.style.transition = 'none'; // No fade animation - remove instantly
    this._overlayContainer.appendChild(this._overlay);

    // Update colors based on variant
    this.updateColors();

    // Check and update shadow based on topic's selected state
    const updateShadowVisibility = () => {
      // Check if topic still exists before updating
      try {
        if (!this._topic || !this._topic.getModel()) {
          // Topic has been removed - hide overlay and return
          this.hide();
          return;
        }
      } catch {
        // Topic may have been removed - hide overlay and return
        this.hide();
        return;
      }

      // Hide shadow if multiple topics are selected or if this topic is not selected
      try {
        if (!this._topic.isOnFocus()) {
          this.hide();
          return;
        }
      } catch {
        // Topic may have been removed - hide overlay and return
        this.hide();
        return;
      }

      // Check if multiple topics are selected
      const designer = this._topic.getDesigner();
      if (designer) {
        try {
          if (designer.getModel().countSelectedTopics() > 1) {
            // Multiple topics selected - hide shadow
            this.hide();
            return;
          }
        } catch {
          // Designer or model may have been removed - hide overlay and return
          this.hide();
          return;
        }
      }

      // Single topic selected and this is it - show shadow
      this.show();
    };

    // Listen to focus and blur events to update shadow visibility. Each event
    // gets its own function: web2d tracks listeners by function, so sharing one
    // between two event types would leave one of them behind on removeEvent.
    // Clicks need no listener of their own: Topic's mousedown handler selects
    // the topic (or toggles it on ctrl/meta) and the Designer's deselects the
    // others, so both end up firing ontfocus/ontblur here.
    this._onTopicFocus = () => updateShadowVisibility();
    this._onTopicBlur = () => updateShadowVisibility();
    topic.addEvent('ontfocus', this._onTopicFocus);
    topic.addEvent('ontblur', this._onTopicBlur);

    // Check initial state - if topic is already selected, show shadow
    updateShadowVisibility();
  }

  private isTopicOnLeftSide(): boolean {
    // If this is the central topic, default to right (start rendering to the right)
    if (this._topic.isCentralTopic()) {
      return false;
    }

    // Find central topic - try walking up parent chain first (for connected topics)
    let centralTopic: Topic | undefined = this._topic.getParent();
    while (centralTopic && !centralTopic.isCentralTopic()) {
      centralTopic = centralTopic.getParent();
    }

    // If not found via parent chain (isolated topic), search all topics
    const designer = this._topic.getDesigner();
    if (!centralTopic && designer) {
      const allTopics = designer.getModel().getTopics();
      centralTopic = allTopics.find((t) => t.isCentralTopic());
    }

    // If we still couldn't find central topic, default to left
    if (!centralTopic) {
      return true;
    }

    // Use the same logic as the layout manager's _getRelativeDirection method:
    // AbstractBasicSorter._getRelativeDirection: offset = position.x - reference.x
    // Returns 1 (right) if offset >= 0, -1 (left) if offset < 0
    // So: topic.x < central.x → left side (true), topic.x >= central.x → right side (false)
    // This matches the logic used in BalancedSorter: order = position.x > rootNode.getPosition().x ? 0 : 1
    try {
      const topicPosition = this._topic.getPosition();
      const centralPosition = centralTopic.getPosition();

      // If topic X is less than central X, it's on the left side
      return topicPosition.x < centralPosition.x;
    } catch {
      // Fallback: default to left if we can't determine
      return true;
    }
  }

  /**
   * Convert hex color to rgba string
   * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) hex colors
   */
  private hexToRgba(hex: string, alpha: number): string {
    // Remove # if present
    let cleanedHex = hex.replace('#', '');

    // Handle 3-digit hex colors (e.g., #FFF -> #FFFFFF)
    if (cleanedHex.length === 3) {
      cleanedHex = cleanedHex
        .split('')
        .map((char) => char + char)
        .join('');
    }

    // Parse RGB values
    const r = parseInt(cleanedHex.substring(0, 2), 16);
    const g = parseInt(cleanedHex.substring(2, 4), 16);
    const b = parseInt(cleanedHex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private getVisualScale(): number {
    const zoom = this._topic.getDesigner()?.getWorkSpace?.()?.getZoom?.();
    return typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0 ? 1 / zoom : 1;
  }

  private getOverlayMetrics(visualScale = this.getVisualScale()): {
    visualScale: number;
    padding: number;
    borderWidth: number;
    ringWidth: number;
    borderRadius: number;
  } {
    const overlayScale = visualScale >= 1 ? 1 : Math.max(0.3, visualScale);
    const borderWidth = Math.max(1, Number((2.5 * overlayScale).toFixed(2)));
    const padding =
      visualScale >= 1 ? 4 : Math.max(borderWidth + 0.5, Number((4 * overlayScale).toFixed(2)));
    const ringWidth = Math.max(1, Number((3 * overlayScale).toFixed(2)));
    const borderRadius = Number((Math.min(8, 8 * visualScale) + padding).toFixed(2));
    return { visualScale, padding, borderWidth, ringWidth, borderRadius };
  }

  private getPillScale(visualScale = this.getVisualScale(), isTouch = isTouchOrMobileDevice()): number {
    return isTouch
      ? Math.max(0.65, Math.min(1.15, Number(visualScale.toFixed(3))))
      : Math.max(0.45, Math.min(1.25, Number(visualScale.toFixed(3))));
  }

  /**
   * Update colors based on topic variant
   */
  private updateColors(metrics = this.getOverlayMetrics()): boolean {
    // Don't update colors if overlay doesn't exist (read-only mode)
    if (!this._overlay) {
      return false;
    }

    const topicColors = this.withTopic((topic) => {
      const variant = topic.getThemeVariant();
      const connectionColor = topic.getConnectionColor(variant);
      return { variant, connectionColor };
    });
    if (!topicColors) {
      return false;
    }

    const { variant, connectionColor } = topicColors;
    // Crisp Apple-style focus border with subtle ambient focus ring scaled with canvas zoom
    this._overlay.style.border = `${metrics.borderWidth}px solid ${connectionColor}`;
    this._overlay.style.boxShadow = `0 0 0 ${metrics.ringWidth}px ${this.hexToRgba(
      connectionColor,
      variant === 'dark' ? 0.28 : 0.16,
    )}`;

    // Background color: create a semi-transparent version based on variant
    let backgroundColor: string;
    if (variant === 'dark') {
      // For dark mode: lighten the connection color and use with low opacity for pure black canvas
      const lightenedColor = ColorUtil.lightenColor(connectionColor, 30);
      backgroundColor = this.hexToRgba(lightenedColor, 0.22);
    } else {
      // For light mode: lighten the connection color significantly and use with higher opacity
      const lightenedColor = ColorUtil.lightenColor(connectionColor, 80);
      backgroundColor = this.hexToRgba(lightenedColor, 0.92);
    }
    this._overlay.style.backgroundColor = backgroundColor;

    // Plus button colors: use connection color, lightened for better contrast
    const plusButtonColor = ColorUtil.lightenColor(connectionColor, 40);
    // Hover color: lighten even more to signal interactivity
    const plusButtonHoverColor = ColorUtil.lightenColor(connectionColor, 60);

    const isDark = variant === 'dark';
    const pillPalette = {
      badgeBase: plusButtonColor,
      badgeHover: plusButtonHoverColor,
      pillBaseBg: isDark ? 'rgba(30, 30, 34, 0.90)' : 'rgba(255, 255, 255, 0.92)',
      pillHoverBg: isDark ? 'rgba(46, 46, 52, 0.96)' : 'rgba(255, 255, 255, 1)',
      pillBaseBorder: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.12)',
      pillHoverBorder: ColorUtil.lightenColor(connectionColor, isDark ? 20 : 35),
      pillShadow: isDark ? '0 2px 10px rgba(0, 0, 0, 0.38)' : '0 2px 8px rgba(15, 23, 42, 0.08)',
      labelColor: isDark ? '#F4F4F5' : '#1E293B',
      kbdBg: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(15, 23, 42, 0.06)',
      kbdColor: isDark ? '#A1A1AA' : '#64748B',
    };

    if (this._rightPlus) {
      this.applyPillColors(this._rightPlus, pillPalette);
    }
    if (this._bottomPlus) {
      this.applyPillColors(this._bottomPlus, pillPalette);
    }
    if (this._moreActionsButton) {
      this.applyPillColors(this._moreActionsButton, pillPalette);
      this._moreActionsButton.style.color = pillPalette.labelColor;
    }

    return true;
  }

  private applyPillColors(
    pill: ActionPillElement,
    palette: {
      badgeBase: string;
      badgeHover: string;
      pillBaseBg: string;
      pillHoverBg: string;
      pillBaseBorder: string;
      pillHoverBorder: string;
      pillShadow: string;
      labelColor: string;
      kbdBg: string;
      kbdColor: string;
    },
  ): void {
    const state = pill._pillState;
    if (state) {
      state.badgeBaseColor = palette.badgeBase;
      state.badgeHoverColor = palette.badgeHover;
      state.pillBaseBg = palette.pillBaseBg;
      state.pillHoverBg = palette.pillHoverBg;
      state.pillBaseBorder = palette.pillBaseBorder;
      state.pillHoverBorder = palette.pillHoverBorder;
      state.badge.style.backgroundColor = palette.badgeBase;
      state.labelSpan.style.color = palette.labelColor;
      state.kbdSpan.style.backgroundColor = palette.kbdBg;
      state.kbdSpan.style.color = palette.kbdColor;
    }
    pill.style.boxShadow = palette.pillShadow;
    pill.style.borderColor = palette.pillBaseBorder;
    this.setupHoverEffect(pill, palette.pillBaseBg, palette.pillHoverBg);
  }

  private computeOverlayGeometry(
    topic: Topic,
    metrics = this.getOverlayMetrics(),
  ): OverlayGeometry | undefined {
    const corners = topic.getAbsoluteCornerCoordinates();
    if (!corners) {
      return undefined;
    }

    const isOnLeft = this.isTopicOnLeftSide();

    // Use ScreenManager's getContainerPosition for consistency
    const containerPosition = this._screenManager.getContainerPosition();

    // Calculate position relative to container
    const left = corners.topLeft.x - containerPosition.left;
    const top = corners.topLeft.y - containerPosition.top;
    const width = corners.topRight.x - corners.topLeft.x;
    const height = corners.bottomLeft.y - corners.topLeft.y;

    // Symmetrical breathing room around the topic card, scaled when zoomed out
    const { padding } = metrics;
    const overlayWidth = width + padding * 2;
    const overlayHeight = height + padding * 2;
    const overlayLeft = left - padding;
    const overlayTop = top - padding;

    return {
      overlayLeft,
      overlayTop,
      overlayWidth,
      overlayHeight,
      overlayRight: overlayLeft + overlayWidth,
      topicLeft: left,
      topicTop: top,
      topicRight: left + width,
      topicBottom: top + height,
      topicCenterX: left + width / 2,
      topicCenterY: top + height / 2,
      isOnLeft,
    };
  }

  private updateOverlay(): void {
    const metrics = this.getOverlayMetrics();
    const geometry = this.withTopic((topic) => this.computeOverlayGeometry(topic, metrics));
    if (!geometry) {
      if (this._overlay) {
        this._overlay.style.display = 'none';
      }
      return;
    }

    const hasChildren = this.withTopic((topic) => topic.getChildren().length > 0) ?? false;
    const hasImage = this.withTopic((topic) => Boolean(topic.getImageUrl()?.trim())) ?? false;

    const colorsUpdated = this.updateColors(metrics);
    if (colorsUpdated === false) {
      if (this._overlay) {
        this._overlay.style.display = 'none';
      }
      return;
    }

    if (this._overlay) {
      this._overlay.style.display = 'block';
      this.applyOverlayFrame(geometry, metrics);
    }
    this.ensurePlusButtons();
    this.updatePlusButtons(geometry, hasChildren, metrics.visualScale);
    this.updateImagePreviewButton(geometry, hasImage, metrics.visualScale);
    this.updateMoreActionsButton(geometry, metrics.visualScale);
  }

  private applyOverlayFrame(
    { overlayLeft, overlayTop, overlayWidth, overlayHeight }: OverlayGeometry,
    metrics = this.getOverlayMetrics(),
  ): void {
    if (!this._overlay) {
      return;
    }

    const fmt = (value: number): string =>
      metrics.visualScale < 1 ? value.toFixed(1) : String(Math.round(value));

    this._overlay.style.left = `${fmt(overlayLeft)}px`;
    this._overlay.style.top = `${fmt(overlayTop)}px`;
    this._overlay.style.width = `${fmt(overlayWidth)}px`;
    this._overlay.style.height = `${fmt(overlayHeight)}px`;

    // Concentric outer radius wrapping the inner card with uniform scaled padding
    this._overlay.style.borderRadius = `${metrics.borderRadius}px`;
  }

  /**
   * Create SVG plus icon
   */
  private createPlusIcon(size = 12): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.style.display = 'block';
    svg.style.fill = 'currentColor';
    svg.style.pointerEvents = 'none';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute(
      'd',
      'M8,2 C8.55228475,2 9,2.45576096 9,3.00247329 L9,7 L12.9975267,7 C13.5116309,7 13.9353477,7.38272018 13.9932556,7.88266744 L14,8 ' +
        'C14,8.55228475 13.544239,9 12.9975267,9 L9,9 L9,12.9975267 C9,13.5116309 8.61727982,13.9353477 8.11733256,13.9932556 L8,14 ' +
        'C7.44771525,14 7,13.544239 7,12.9975267 L7,9 L3.00247329,9 C2.44882258,9 2,8.55613518 2,8 C2,7.44771525 2.45576096,7 3.00247329,7 ' +
        'L7,7 L7,3.00247329 C7,2.48836906 7.38272018,2.06465235 7.88266744,2.00674437 L8,2 Z',
    );

    svg.appendChild(path);
    return svg;
  }

  private createZoomIcon(size = 14): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'block';
    svg.style.pointerEvents = 'none';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '11');
    circle.setAttribute('cy', '11');
    circle.setAttribute('r', '7');

    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    handle.setAttribute('x1', '16.5');
    handle.setAttribute('y1', '16.5');
    handle.setAttribute('x2', '21');
    handle.setAttribute('y2', '21');

    const plusH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    plusH.setAttribute('x1', '8');
    plusH.setAttribute('y1', '11');
    plusH.setAttribute('x2', '14');
    plusH.setAttribute('y2', '11');

    const plusV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    plusV.setAttribute('x1', '11');
    plusV.setAttribute('y1', '8');
    plusV.setAttribute('x2', '11');
    plusV.setAttribute('y2', '14');

    svg.appendChild(circle);
    svg.appendChild(handle);
    svg.appendChild(plusH);
    svg.appendChild(plusV);
    return svg;
  }

  private createMoreActionsIcon(size = 16): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'currentColor');
    svg.style.display = 'block';
    svg.style.pointerEvents = 'none';

    for (const cx of [5, 12, 19]) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(cx));
      dot.setAttribute('cy', '12');
      dot.setAttribute('r', '2');
      svg.appendChild(dot);
    }
    return svg;
  }

  private setPillActiveState(button: ActionPillElement, active: boolean): void {
    const state = button._pillState;
    if (active) {
      if (button._hoverColor) {
        button.style.backgroundColor = button._hoverColor;
      }
      if (state?.badgeHoverColor) {
        state.badge.style.backgroundColor = state.badgeHoverColor;
      }
      if (state?.pillHoverBorder) {
        button.style.borderColor = state.pillHoverBorder;
      }
    } else {
      if (button._baseColor) {
        button.style.backgroundColor = button._baseColor;
      }
      if (state?.badgeBaseColor) {
        state.badge.style.backgroundColor = state.badgeBaseColor;
      }
      if (state?.pillBaseBorder) {
        button.style.borderColor = state.pillBaseBorder;
      }
    }
  }

  /**
   * Set up hover effect for action pills
   */
  private setupHoverEffect(
    button: ActionPillElement,
    baseColor: string,
    hoverColor: string,
  ): void {
    if (button.dataset['hoverSetup'] === 'true') {
      button._baseColor = baseColor;
      button._hoverColor = hoverColor;
      if (button.style.backgroundColor !== hoverColor) {
        button.style.backgroundColor = baseColor;
      }
      return;
    }

    button._baseColor = baseColor;
    button._hoverColor = hoverColor;
    button.style.backgroundColor = baseColor;

    // Read the colors on every event: later calls (e.g. after a theme change)
    // only update the stored values.
    button.addEventListener('mouseenter', () => {
      this.setPillActiveState(button, true);
    });

    button.addEventListener('mouseleave', () => {
      this.setPillActiveState(button, false);
    });

    button.dataset['hoverSetup'] = 'true';
  }

  /**
   * Helper function to handle both click and touch events for action buttons
   * Prevents duplicate triggers by tracking if action was already handled
   */
  private addPlusButtonHandlers(button: HTMLButtonElement, handler: () => void): void {
    let touchHandled = false;

    // Handle click events (desktop, mobile fallback, and native Enter/Space keyboard activation)
    button.addEventListener('click', (event) => {
      // If touch was already handled, ignore click (prevents double-trigger)
      if (touchHandled) {
        touchHandled = false;
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      handler();
    });

    // Keep Enter/Space activation local to the focused button so DesignerKeyboard does not hijack it
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation();
      }
    });

    // Handle touch events (mobile)
    button.addEventListener('touchstart', (event) => {
      // Stop propagation but don't prevent default to allow normal touch behavior
      event.stopPropagation();
      this.setPillActiveState(button, true);
    });

    button.addEventListener('touchend', (event) => {
      event.stopPropagation();
      event.preventDefault();
      touchHandled = true;
      handler();
      setTimeout(() => {
        this.setPillActiveState(button, false);
      }, 150);
      setTimeout(() => {
        touchHandled = false;
      }, 300);
    });

    // Reset flag and color if touch is cancelled (e.g., user swipes away)
    button.addEventListener('touchcancel', () => {
      touchHandled = false;
      this.setPillActiveState(button, false);
    });
  }

  private createActionPill(onTrigger: () => void): ActionPillElement {
    const isTouch = isTouchOrMobileDevice();
    const pill = document.createElement('button') as ActionPillElement;
    pill.type = 'button';
    pill.className = 'wise-topic-selection-pill';
    pill.style.position = 'absolute';
    pill.style.left = '0px';
    pill.style.top = '0px';
    pill.style.display = 'inline-flex';
    pill.style.alignItems = 'center';
    pill.style.gap = '6px';
    pill.style.boxSizing = 'border-box';
    pill.style.borderRadius = '9999px';
    pill.style.border = '1px solid rgba(15, 23, 42, 0.12)';
    pill.style.padding = isTouch ? '6px 12px 6px 8px' : '3px 8px 3px 4px';
    pill.style.minHeight = isTouch ? '36px' : '26px';
    pill.style.margin = '0';
    pill.style.pointerEvents = 'auto';
    pill.style.cursor = 'pointer';
    pill.style.zIndex = CANVAS_AFFORDANCE_Z_INDEX;
    pill.style.userSelect = 'none';
    pill.style.whiteSpace = 'nowrap';
    pill.style.backdropFilter = 'blur(8px)';
    pill.style.setProperty('-webkit-backdrop-filter', 'blur(8px)');
    pill.style.transition = 'background-color 0.16s ease, border-color 0.16s ease';
    pill.style.transformOrigin = '0 0';

    const badge = document.createElement('span');
    badge.style.width = isTouch ? '22px' : '18px';
    badge.style.height = isTouch ? '22px' : '18px';
    badge.style.borderRadius = '50%';
    badge.style.color = '#ffffff';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.flexShrink = '0';
    badge.style.transition = 'background-color 0.16s ease';
    badge.appendChild(this.createPlusIcon(isTouch ? 13 : 11));

    const labelSpan = document.createElement('span');
    labelSpan.style.fontSize = '12px';
    labelSpan.style.fontWeight = '500';
    labelSpan.style.fontFamily =
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    labelSpan.style.lineHeight = '1';
    labelSpan.style.whiteSpace = 'nowrap';

    const kbdSpan = document.createElement('span');
    kbdSpan.setAttribute('aria-hidden', 'true');
    kbdSpan.style.fontSize = '10px';
    kbdSpan.style.fontWeight = '500';
    kbdSpan.style.fontFamily =
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    kbdSpan.style.lineHeight = '1';
    kbdSpan.style.padding = '2px 5px';
    kbdSpan.style.borderRadius = '4px';
    kbdSpan.style.display = isTouch ? 'none' : 'inline-flex';
    kbdSpan.style.alignItems = 'center';
    kbdSpan.style.justifyContent = 'center';

    pill.appendChild(badge);
    pill.appendChild(labelSpan);
    pill.appendChild(kbdSpan);
    pill._pillState = { badge, labelSpan, kbdSpan };

    this.addPlusButtonHandlers(pill, onTrigger);
    return pill;
  }

  private ensurePillsContainer(): HTMLDivElement {
    if (this._pillsContainer && this._pillsContainer.parentElement === this._containerElement) {
      return this._pillsContainer;
    }
    const container = document.createElement('div');
    container.className = 'wise-topic-pills-layer';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = CANVAS_AFFORDANCE_Z_INDEX;
    container.style.overflow = 'visible';
    this._containerElement.appendChild(container);
    this._pillsContainer = container;
    return container;
  }

  private ensurePlusButtons(): void {
    if (this._rightPlus && !this._rightPlus.parentElement) {
      this._rightPlus = undefined;
    }
    if (this._bottomPlus && !this._bottomPlus.parentElement) {
      this._bottomPlus = undefined;
    }

    const pillsContainer = this.ensurePillsContainer();

    if (!this._rightPlus) {
      const rightPlus = this.createActionPill(() => {
        this._createChild();
      });
      pillsContainer.appendChild(rightPlus);
      this._rightPlus = rightPlus;
      this.updateColors();
      this.updatePlusButtonTooltips();
    }

    if (!this._bottomPlus) {
      const bottomPlus = this.createActionPill(() => {
        this._createSibling();
      });
      pillsContainer.appendChild(bottomPlus);
      this._bottomPlus = bottomPlus;
      this.updateColors();
      this.updatePlusButtonTooltips();
    }
  }

  private ensureImagePreviewButton(): void {
    if (this._imagePreviewButton && !this._imagePreviewButton.parentElement) {
      this._imagePreviewButton = undefined;
    }
    if (this._imagePreviewButton) {
      return;
    }
    const isTouch = isTouchOrMobileDevice();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wise-topic-image-preview';
    button.appendChild(this.createZoomIcon(isTouch ? 15 : 13));
    button.style.position = 'absolute';
    button.style.left = '0px';
    button.style.top = '0px';
    button.style.width = isTouch ? '30px' : '24px';
    button.style.height = isTouch ? '30px' : '24px';
    button.style.borderRadius = '50%';
    button.style.backgroundColor = 'rgba(15, 23, 42, 0.72)';
    button.style.color = '#ffffff';
    button.style.border = '1px solid rgba(255, 255, 255, 0.24)';
    button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    button.style.backdropFilter = 'blur(6px)';
    button.style.setProperty('-webkit-backdrop-filter', 'blur(6px)');
    button.style.display = 'none';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.padding = '0';
    button.style.margin = '0';
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'zoom-in';
    button.style.zIndex = CANVAS_AFFORDANCE_Z_INDEX;
    button.style.transformOrigin = '0 0';
    button.style.transform = 'translate(-100%, 0)';
    button.setAttribute('title', '查看大图');
    button.setAttribute('aria-label', '查看大图');

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'rgba(15, 23, 42, 0.72)';
    });

    this.addPlusButtonHandlers(button, () => {
      this.withTopic((topic) => {
        topic.getDesigner()?.previewTopicImage(topic);
      });
    });

    this.ensurePillsContainer().appendChild(button);
    this._imagePreviewButton = button;
  }

  private updateImagePreviewButton(
    geometry: OverlayGeometry,
    hasImage: boolean,
    visualScale = this.getVisualScale(),
  ): void {
    if (!hasImage) {
      if (this._imagePreviewButton) {
        this._imagePreviewButton.style.display = 'none';
        this._imagePreviewButton.style.pointerEvents = 'none';
      }
      if (this._moreActionsButton) {
        this._moreActionsButton.style.display = 'none';
        this._moreActionsButton.style.pointerEvents = 'none';
      }
      return;
    }

    this.ensureImagePreviewButton();
    if (!this._imagePreviewButton) {
      return;
    }

    const isTouch = isTouchOrMobileDevice();
    const buttonScale = this.getPillScale(visualScale, isTouch);
    const scalePrefix = buttonScale === 1 ? '' : `scale(${buttonScale}) `;
    this._imagePreviewButton.style.setProperty('--wise-pill-scale', String(buttonScale));
    this._imagePreviewButton.style.width = isTouch ? '30px' : '24px';
    this._imagePreviewButton.style.height = isTouch ? '30px' : '24px';
    this._imagePreviewButton.style.left = `${geometry.topicRight - 6 * buttonScale}px`;
    this._imagePreviewButton.style.top = `${geometry.topicTop + 6 * buttonScale}px`;
    this._imagePreviewButton.style.transform = `${scalePrefix}translate(-100%, 0)`;
    this._imagePreviewButton.style.display = 'flex';
    this._imagePreviewButton.style.pointerEvents = 'auto';
  }

  private ensureMoreActionsButton(): void {
    if (this._moreActionsButton && !this._moreActionsButton.parentElement) {
      this._moreActionsButton = undefined;
    }
    if (this._moreActionsButton) {
      return;
    }
    const button = document.createElement('button') as ActionPillElement;
    button.type = 'button';
    button.className = 'wise-topic-more-actions';
    button.appendChild(this.createMoreActionsIcon(16));
    button.style.position = 'absolute';
    button.style.left = '0px';
    button.style.top = '0px';
    button.style.width = '34px';
    button.style.height = '28px';
    button.style.borderRadius = '9999px';
    button.style.border = '1px solid rgba(15, 23, 42, 0.12)';
    button.style.display = 'none';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.padding = '0';
    button.style.margin = '0';
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';
    button.style.userSelect = 'none';
    button.style.zIndex = CANVAS_AFFORDANCE_Z_INDEX;
    button.style.backdropFilter = 'blur(8px)';
    button.style.setProperty('-webkit-backdrop-filter', 'blur(8px)');
    button.style.transition = 'background-color 0.16s ease, border-color 0.16s ease';
    button.style.transformOrigin = '0 0';
    button.style.transform = 'translate(-50%, -100%)';
    button.setAttribute('title', '更多操作');
    button.setAttribute('aria-label', '更多操作');

    this.addPlusButtonHandlers(button, () => {
      this.withTopic((topic) => {
        const rect = button.getBoundingClientRect();
        const anchorX = rect.left + rect.width / 2;
        const anchorY = rect.bottom + 6;
        topic.getDesigner()?.openTopicContextMenu(topic, anchorX, anchorY);
      });
    });

    this.ensurePillsContainer().appendChild(button);
    this._moreActionsButton = button;
    this.updateColors();
  }

  private updateMoreActionsButton(
    geometry: OverlayGeometry,
    visualScale = this.getVisualScale(),
  ): void {
    const canOpenMenu =
      isTouchOrMobileDevice() &&
      (this.withTopic((topic) => (topic.getDesigner()?.listenerCount('contextMenu') ?? 0) > 0) ??
        false);

    if (!canOpenMenu) {
      if (this._moreActionsButton) {
        this._moreActionsButton.style.display = 'none';
        this._moreActionsButton.style.pointerEvents = 'none';
      }
      return;
    }

    this.ensureMoreActionsButton();
    if (!this._moreActionsButton) {
      return;
    }

    const buttonScale = this.getPillScale(visualScale, true);
    const scalePrefix = buttonScale === 1 ? '' : `scale(${buttonScale}) `;
    this._moreActionsButton.style.setProperty('--wise-pill-scale', String(buttonScale));
    this._moreActionsButton.style.left = `${geometry.topicCenterX}px`;
    this._moreActionsButton.style.top = `${geometry.topicTop - 10 * buttonScale}px`;
    this._moreActionsButton.style.transform = `${scalePrefix}translate(-50%, -100%)`;
    this._moreActionsButton.style.display = 'inline-flex';
    this._moreActionsButton.style.pointerEvents = 'auto';
  }

  /**
   * Update tooltips and pill content based on orientation
   */
  private updatePlusButtonTooltips(): void {
    const isTouch = isTouchOrMobileDevice();

    const syncPillContent = (
      pill: ActionPillElement | undefined,
      tooltip: string,
      label: string,
      kbd: string,
    ) => {
      if (!pill) {
        return;
      }
      pill.setAttribute('title', tooltip);
      pill.setAttribute('aria-label', tooltip);
      const state = pill._pillState;
      if (state) {
        state.labelSpan.textContent = label;
        state.kbdSpan.textContent = kbd;
        state.kbdSpan.style.display = isTouch ? 'none' : 'inline-flex';
        state.badge.style.width = isTouch ? '22px' : '18px';
        state.badge.style.height = isTouch ? '22px' : '18px';
      }
      pill.style.padding = isTouch ? '6px 12px 6px 8px' : '3px 8px 3px 4px';
      pill.style.minHeight = isTouch ? '36px' : '26px';
    };

    syncPillContent(this._rightPlus, $msg('PLUS_TOOLTIP_CREATE_CHILD'), '子主题', 'Tab');
    syncPillContent(this._bottomPlus, $msg('PLUS_TOOLTIP_CREATE_SIBLING'), '同级', '↵');
  }

  private updatePlusButtons(
    geometry: OverlayGeometry,
    hasChildren: boolean,
    visualScale = this.getVisualScale(),
  ): void {
    const pillScale = this.getPillScale(visualScale);
    const scalePrefix = pillScale === 1 ? '' : `scale(${pillScale}) `;
    const rightPillDistance = 14 * pillScale;
    const bottomPillDistance = 10 * pillScale;
    const isCentral = this.withTopic((topic) => topic.isCentralTopic()) ?? false;

    if (this._rightPlus) {
      this._rightPlus.style.setProperty('--wise-pill-scale', String(pillScale));
      if (geometry.isOnLeft) {
        this._rightPlus.style.left = `${geometry.topicLeft - rightPillDistance}px`;
        this._rightPlus.style.right = 'auto';
        this._rightPlus.style.transform = `${scalePrefix}translate(-100%, -50%)`;
        this._rightPlus.style.flexDirection = 'row-reverse';
      } else {
        this._rightPlus.style.left = `${geometry.topicRight + rightPillDistance}px`;
        this._rightPlus.style.right = 'auto';
        this._rightPlus.style.transform = `${scalePrefix}translate(0, -50%)`;
        this._rightPlus.style.flexDirection = 'row';
      }
      this._rightPlus.style.top = `${geometry.topicCenterY}px`;
      const shouldDisplay = !hasChildren;

      if (shouldDisplay) {
        this._rightPlus.style.display = 'inline-flex';
        this._rightPlus.style.pointerEvents = 'auto';
      } else {
        this._rightPlus.style.display = 'none';
        this._rightPlus.style.pointerEvents = 'none';
      }
    }

    if (this._bottomPlus) {
      this._bottomPlus.style.setProperty('--wise-pill-scale', String(pillScale));
      this._bottomPlus.style.left = `${geometry.topicCenterX}px`;
      this._bottomPlus.style.top = `${geometry.topicBottom + bottomPillDistance}px`;
      this._bottomPlus.style.transform = `${scalePrefix}translate(-50%, 0)`;
      this._bottomPlus.style.flexDirection = 'row';
      const shouldDisplay = !isCentral;

      if (shouldDisplay) {
        this._bottomPlus.style.display = 'inline-flex';
        this._bottomPlus.style.pointerEvents = 'auto';
      } else {
        this._bottomPlus.style.display = 'none';
        this._bottomPlus.style.pointerEvents = 'none';
      }
    }

    this.updatePlusButtonTooltips();
  }

  /**
   * Shifts the selection overlay and action pills via GPU `translate3d` during a pan preview,
   * avoiding synchronous layout reads (`getBoundingClientRect`) on every animation frame.
   */
  setPanPreviewOffset(active: boolean, dx: number, dy: number): void {
    if (!this._isVisible && active) {
      return;
    }
    const nextTransform = active && (dx !== 0 || dy !== 0) ? `translate3d(${dx}px, ${dy}px, 0)` : '';
    const nextWillChange = active ? 'transform' : '';
    if (this._overlayContainer) {
      this._overlayContainer.style.transform = nextTransform;
      this._overlayContainer.style.willChange = nextWillChange;
    }
    if (this._pillsContainer) {
      this._pillsContainer.style.transform = nextTransform;
      this._pillsContainer.style.willChange = nextWillChange;
    }
    const pills: Array<[HTMLElement | undefined, string]> = [
      [this._rightPlus, 'blur(8px)'],
      [this._bottomPlus, 'blur(8px)'],
      [this._imagePreviewButton, 'blur(6px)'],
      [this._moreActionsButton, 'blur(8px)'],
    ];
    for (const [pill, blur] of pills) {
      if (!pill) continue;
      const targetBlur = active ? 'none' : blur;
      if (pill.style.backdropFilter !== targetBlur) {
        pill.style.backdropFilter = targetBlur;
        pill.style.setProperty('-webkit-backdrop-filter', targetBlur);
      }
    }
  }

  toggle(): void {
    const topicExists = this.withTopic(() => true);
    if (!topicExists) {
      if (this._overlay) {
        this._overlay.style.display = 'none';
      }
      return;
    }

    this._isVisible = !this._isVisible;

    if (this._isVisible) {
      this.withTopic((topic) => topic.setOuterHaloSuppressed?.(true));
      this.updateOverlay();
    } else {
      this.withTopic((topic) => topic.setOuterHaloSuppressed?.(false));
      if (this._overlay) {
        this._overlay.style.display = 'none';
      }

      if (this._rightPlus) {
        this._rightPlus.style.display = 'none';
        this._rightPlus.style.pointerEvents = 'none';
      }
      if (this._bottomPlus) {
        this._bottomPlus.style.display = 'none';
        this._bottomPlus.style.pointerEvents = 'none';
      }
      if (this._imagePreviewButton) {
        this._imagePreviewButton.style.display = 'none';
        this._imagePreviewButton.style.pointerEvents = 'none';
      }
      if (this._moreActionsButton) {
        this._moreActionsButton.style.display = 'none';
        this._moreActionsButton.style.pointerEvents = 'none';
      }
    }
  }

  update(): void {
    // Check topic's selected state and update visibility accordingly
    // Hide if multiple topics are selected
    if (!this._topic.isOnFocus()) {
      if (this._isVisible) {
        this.hide();
      }
      return;
    }

    // Check if multiple topics are selected
    const designer = this._topic.getDesigner();
    if (designer) {
      if (designer.getModel().countSelectedTopics() > 1) {
        // Multiple topics selected - hide shadow
        if (this._isVisible) {
          this.hide();
        }
        return;
      }
    }

    // Single topic selected and this is it - show shadow
    if (!this._isVisible) {
      this.show();
    }
    this.updateOverlay();
  }

  show(): void {
    // Check if topic still exists before showing
    try {
      if (!this._topic || !this._topic.getModel()) {
        // Topic has been removed - hide overlay and return
        if (this._overlay) {
          this._overlay.style.display = 'none';
        }
        return;
      }
    } catch {
      // Topic may have been removed - hide overlay and return
      if (this._overlay) {
        this._overlay.style.display = 'none';
      }
      return;
    }

    if (!this._isVisible) {
      this.toggle();
    }
  }

  hide(): void {
    if (this._isVisible) {
      this.toggle();
    }
  }

  private withTopic<T>(callback: (topic: Topic) => T): T | undefined {
    try {
      if (!this._topic || !this._topic.getModel()) {
        return undefined;
      }
      return callback(this._topic);
    } catch {
      return undefined;
    }
  }

  private _createSibling(): void {
    // The designer the topic was built with
    const designer = this._topic.getDesigner();
    if (!designer) {
      console.warn('Designer instance not available for creating sibling');
      return;
    }

    // Ensure this topic is selected (same behavior as keyboard shortcuts)
    // The shadow is only shown when topic is focused, but we ensure it's selected
    // to match keyboard behavior exactly
    const selectedTopics = designer.getModel().filterSelectedTopics();
    if (selectedTopics.length === 0 || selectedTopics[0] !== this._topic) {
      // Select this topic if it's not already selected
      designer.onObjectFocusEvent(this._topic);
      this._topic.setOnFocus(true);
    }

    // Create sibling (same as Enter key) - used by bottom button
    designer.createSiblingForSelectedNode();
  }

  private _createChild(): void {
    // The designer the topic was built with
    const designer = this._topic.getDesigner();
    if (!designer) {
      console.warn('Designer instance not available for creating child');
      return;
    }

    // Ensure this topic is selected (same behavior as keyboard shortcuts)
    // The shadow is only shown when topic is focused, but we ensure it's selected
    // to match keyboard behavior exactly
    const selectedTopics = designer.getModel().filterSelectedTopics();
    if (selectedTopics.length === 0 || selectedTopics[0] !== this._topic) {
      // Select this topic if it's not already selected
      designer.onObjectFocusEvent(this._topic);
      this._topic.setOnFocus(true);
    }

    // Create child (same as Tab key)
    designer.createChildForSelectedNode();
  }

  dispose(): void {
    this.withTopic((topic) => topic.setOuterHaloSuppressed?.(false));
    // Remove the listeners added to the topic, so a re-created shadow doesn't stack them
    const onTopicFocus = this._onTopicFocus;
    const onTopicBlur = this._onTopicBlur;
    this._onTopicFocus = undefined;
    this._onTopicBlur = undefined;
    try {
      if (onTopicFocus) {
        this._topic.removeEvent('ontfocus', onTopicFocus);
      }
      if (onTopicBlur) {
        this._topic.removeEvent('ontblur', onTopicBlur);
      }
    } catch {
      // Topic may have been removed along with its element
    }

    // Remove all elements in the same lifecycle
    if (this._overlayContainer && this._overlayContainer.parentElement) {
      this._overlayContainer.parentElement.removeChild(this._overlayContainer);
    }

    // Clear references
    this._overlayContainer = undefined;
    this._overlay = undefined;

    // Remove plus buttons and wrapper from main container
    if (this._rightPlus && this._rightPlus.parentElement) {
      this._rightPlus.parentElement.removeChild(this._rightPlus);
    }

    if (this._bottomPlus && this._bottomPlus.parentElement) {
      this._bottomPlus.parentElement.removeChild(this._bottomPlus);
    }

    if (this._imagePreviewButton && this._imagePreviewButton.parentElement) {
      this._imagePreviewButton.parentElement.removeChild(this._imagePreviewButton);
    }

    if (this._moreActionsButton && this._moreActionsButton.parentElement) {
      this._moreActionsButton.parentElement.removeChild(this._moreActionsButton);
    }

    if (this._pillsContainer && this._pillsContainer.parentElement) {
      this._pillsContainer.parentElement.removeChild(this._pillsContainer);
    }

    // Clear references
    this._pillsContainer = undefined;
    this._rightPlus = undefined;
    this._bottomPlus = undefined;
    this._imagePreviewButton = undefined;
    this._moreActionsButton = undefined;
  }

  /**
   * Clean up all selection shadows for a designer instance
   */
  static cleanupSelectionShadows(designer: Designer): void {
    const selectionShadows = designer.getSelectionShadows();
    selectionShadows.forEach((shadow) => {
      shadow.dispose();
    });
    selectionShadows.clear();
  }

  /**
   * Ensure a shadow exists for a topic (create if it doesn't exist)
   * Called when a topic receives focus
   */
  static ensureTopicShadow(designer: Designer, topic: Topic): void {
    const selectionShadows = designer.getSelectionShadows();
    if (!selectionShadows.has(topic)) {
      const screenManager = designer.getScreenManager();
      const containerElement = designer.getContainer();
      const shadow = new HTMLTopicSelected(topic, containerElement, screenManager);
      selectionShadows.set(topic, shadow);
    }
  }

  /**
   * Initialize selection shadows for a designer instance
   * Sets up event listeners and creates shadows for already-selected topics.
   * Calling it again for the same designer replaces the previous registration.
   * Returns a function that removes the LayoutEventBus handlers it registered.
   */
  static initializeSelectionShadows(designer: Designer): Unsubscribe {
    // Drop the handlers of a previous call first
    unsubscribeByDesigner.get(designer)?.();

    // Don't initialize selection shadows in read-only mode
    if (designer.isReadOnly()) {
      return () => undefined;
    }

    // Selection assistance is enabled by default

    HTMLTopicSelected.cleanupSelectionShadows(designer);

    // Create shadows for topics already selected on map load
    // (setOnFocus only fires events on state change, so already-selected topics won't fire topicSelected)
    designer
      .getModel()
      .filterSelectedTopics()
      .forEach((topic) => HTMLTopicSelected.ensureTopicShadow(designer, topic));

    const findTopicByModel = (nodeModel: NodeModel): Topic | undefined =>
      designer.getModel().findTopicByModel(nodeModel);

    const selectionShadows = designer.getSelectionShadows();

    // Update shadows when layout changes (position, size, etc.)
    // Use double requestAnimationFrame to ensure DOM updates are complete
    // This is especially important for zoom changes where coordinates need to be recalculated
    // The events until the first frame share one update: selecting every topic, or a layout,
    // fires one per topic. An event after it gets its own, two frames later as before.
    let updatePending = false;
    const updateShadows = () => {
      if (updatePending) {
        return;
      }
      updatePending = true;
      requestAnimationFrame(() => {
        updatePending = false;
        requestAnimationFrame(() => {
          selectionShadows.forEach((shadow) => shadow.update());
        });
      });
    };

    // The canvas moved under the topics (pan, zoom, window resize): its coordinates are already
    // final, so the overlays follow in the same frame. Otherwise they lag two frames behind, and a
    // capture of that frame (a screenshot taken right after a resize) shows them off their topic.
    // The deferred pass still runs, for a layout that settles later.
    const followCanvas = () => {
      selectionShadows.forEach((shadow) => shadow.update());
      updateShadows();
    };

    // Lifecycle hooks: create shadow when topic is selected
    const onTopicSelected = (nodeModel: NodeModel) => {
      const topic = findTopicByModel(nodeModel);
      if (topic) {
        HTMLTopicSelected.ensureTopicShadow(designer, topic);
      }
      // Update all shadows to handle multiple selection (hide shadows if multiple topics selected)
      updateShadows();
    };

    // Lifecycle hooks: hide shadows when topic is unselected (may reveal single selection)
    // Update all shadows to handle selection count changes
    const onTopicUnselected = () => updateShadows();

    // Lifecycle hooks: dispose shadow when topic is removed
    const onTopicRemoved = (nodeModel: NodeModel) => {
      const topic = findTopicByModel(nodeModel);
      if (topic && selectionShadows.has(topic)) {
        selectionShadows.get(topic)?.dispose();
        selectionShadows.delete(topic);
      }
    };

    // Each handler is checked against the payload its event sends.
    const removals: Unsubscribe[] = [];
    const bus = designer.getLayoutEventBus();
    const on = <T extends LayoutEventBusType>(
      type: T,
      handler: (payload: LayoutEventPayloads[T]) => void,
    ): void => {
      bus.addEvent(type, handler);
      removals.push(() => bus.removeEvent(type, handler));
    };
    on('topicSelected', onTopicSelected);
    on('topicUnselected', onTopicUnselected);
    on('topicRemoved', onTopicRemoved);
    on('forceLayout', updateShadows);
    on('topicResize', updateShadows);
    on('topicMoved', updateShadows);
    on('topicConnected', updateShadows);
    // Update shadows when canvas is panned/dragged or zoomed
    on('canvasPanPreview', ({ active, dx, dy }) => {
      selectionShadows.forEach((shadow) => shadow.setPanPreviewOffset(active, dx, dy));
    });
    on('canvasPanned', followCanvas);
    on('canvasZoomed', followCanvas);

    const unsubscribe: Unsubscribe = () => {
      removals.forEach((remove) => remove());
      if (unsubscribeByDesigner.get(designer) === unsubscribe) {
        unsubscribeByDesigner.delete(designer);
      }
    };
    unsubscribeByDesigner.set(designer, unsubscribe);
    return unsubscribe;
  }
}

export default HTMLTopicSelected;
