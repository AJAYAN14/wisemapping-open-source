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
import type { Group as GroupType } from '@wisemapping/web2d';
import { Ellipse, Group, Rect, StraightLine, Text } from '@wisemapping/web2d';

import TopicConfig from './TopicConfig';
import type Topic from './Topic';
import ColorUtil from './theme/ColorUtil';
import { markObjectTouch, markShrinkConnectorTouch } from './util/objectTouch';

type ConnectorDirection = 'left' | 'right' | 'down';

const DEFAULT_COLOR = '#64748b';
const EXPANDED_REST_OPACITY = 0.78;
const EXPANDED_ACTIVE_OPACITY = 1;
const MINUS_HALF_LENGTH = 3.5;
const COUNT_FONT_PT = 7.5;
const DRAG_CLICK_TOLERANCE_PX = 6;

const countHiddenDescendants = (topic: Topic): number => {
  let total = 0;
  const children = topic.getChildren();
  children.forEach((child) => {
    total += 1 + countHiddenDescendants(child);
  });
  return total;
};

const formatCollapsedCount = (count: number): string => {
  if (count <= 0) {
    return '+';
  }
  return count > 99 ? '99+' : String(count);
};

const computePillWidth = (label: string): number => Math.max(18, label.length * 6 + 10);

const contrastTextColor = (bgColor: string): string => {
  const whiteRatio = ColorUtil.contrastRatio('#ffffff', bgColor);
  const darkRatio = ColorUtil.contrastRatio('#0f172a', bgColor);
  if (whiteRatio === undefined || darkRatio === undefined) {
    return '#ffffff';
  }
  return whiteRatio >= darkRatio ? '#ffffff' : '#0f172a';
};

class ShirinkConnector {
  private _topic: Topic;

  private _isShrink: boolean;

  private _isHovered: boolean;

  private _isTopicHighlighted: boolean;

  private _color: string;

  private _direction: ConnectorDirection;

  private _anchorX: number;

  private _anchorY: number;

  private _group: GroupType;

  private _stem: StraightLine;

  private _badgeRect: Rect;

  private _minusLine: StraightLine;

  private _countText: Text;

  // Kept as `_ellipse` for the interactive hit target (and test compatibility).
  private _ellipse: Ellipse;

  constructor(topic: Topic) {
    this._topic = topic;
    this._isShrink = false;
    this._isHovered = false;
    this._isTopicHighlighted = false;
    this._color = DEFAULT_COLOR;
    this._direction = 'right';
    this._anchorX = 0;
    this._anchorY = 0;

    this._group = new Group({
      width: 1,
      height: 1,
      coordSizeWidth: 1,
      coordSizeHeight: 1,
    });

    this._stem = new StraightLine({
      strokeWidth: 2,
      strokeColor: this._color,
      strokeOpacity: 1,
    });

    this._badgeRect = new Rect(1, {
      width: TopicConfig.CONNECTOR_WIDTH,
      height: TopicConfig.CONNECTOR_WIDTH,
      fillColor: '#ffffff',
      stroke: `1.8 solid ${this._color}`,
    });

    this._minusLine = new StraightLine({
      strokeWidth: 1.8,
      strokeColor: this._color,
      strokeOpacity: 1,
    });

    this._countText = new Text();
    this._countText.setFont('Arial', COUNT_FONT_PT, 'normal', 'normal');

    this._ellipse = new Ellipse({
      width: TopicConfig.CONNECTOR_HIT_SIZE,
      height: TopicConfig.CONNECTOR_HIT_SIZE,
      fillColor: '#000000',
      fillOpacity: 0,
      stroke: '0 solid transparent',
      strokeOpacity: 0,
    });

    // Decorative primitives stay non-interactive so `_ellipse` receives all pointer/touch events
    // uniformly without hover flicker across the entire hit zone.
    [this._stem, this._badgeRect, this._minusLine, this._countText].forEach((el) => {
      el.peer._native.style.pointerEvents = 'none';
      this._group.append(el);
    });
    this._ellipse.peer._native.style.pointerEvents = 'all';
    this._group.append(this._ellipse);

    this._registerEvents();
    this.setColor(this._color);
    const model = topic.getModel();
    this.changeRender(model.areChildrenShrunken());
  }

  private _registerEvents(): void {
    const hitArea = this._ellipse;
    let downPos: { x: number; y: number } | undefined;

    hitArea.addEvent('mousedown', (event: Event) => {
      const me = event as MouseEvent;
      downPos = { x: me.clientX, y: me.clientY };
      // Avoid node selection/drag and background click.
      event.stopPropagation();
    });

    hitArea.addEvent('click', (event: Event) => {
      event.stopPropagation();
      const me = event as MouseEvent;
      if (downPos) {
        const moved = Math.hypot(me.clientX - downPos.x, me.clientY - downPos.y);
        downPos = undefined;
        if (moved > DRAG_CLICK_TOLERANCE_PX) {
          return;
        }
      }

      const model = this._topic.getModel();
      const collapse = !model.areChildrenShrunken();
      const topicId = this._topic.getId();
      const actionDispatcher = this._topic.getActionDispatcher();
      actionDispatcher.shrinkBranch([topicId], collapse);
    });

    hitArea.addEvent('touchstart', (event: Event) => {
      // Keep a tap on the collapse handle from turning into a background click, while letting
      // touchstart bubble to the canvas for pan/pinch. Mark it as a connector touch so the parent
      // topic does not start a long-press text-edit timer on top of the collapse handle.
      markObjectTouch(event);
      markShrinkConnectorTouch(event);
    });

    hitArea.addEvent('dblclick', (event: Event) => {
      // Avoid node text editing on double click.
      event.stopPropagation();
    });

    hitArea.addEvent('mouseover', () => {
      this._isHovered = true;
      this._updateAppearance();
    });

    hitArea.addEvent('mouseout', () => {
      this._isHovered = false;
      this._updateAppearance();
    });

    hitArea.setCursor('pointer');
  }

  setTopicHighlighted(highlighted: boolean): void {
    if (this._isTopicHighlighted !== highlighted) {
      this._isTopicHighlighted = highlighted;
      this._updateAppearance();
    }
  }

  changeRender(isShrink: boolean): void {
    this._isShrink = isShrink;
    this._updateAppearance();
    this._layoutElements();
  }

  setColor(color: string): void {
    this._color = color || DEFAULT_COLOR;
    this._updateAppearance();
  }

  private _updateAppearance(): void {
    const color = this._color;
    this._stem.setStroke(2, 'solid', color, 1);

    if (this._isShrink) {
      const label = formatCollapsedCount(countHiddenDescendants(this._topic));
      this._countText.setText(label);
      this._centerCountTspan();
      this._countText.setColor(contrastTextColor(color));
      this._countText.peer._native.style.display = '';
      this._minusLine.peer._native.style.display = 'none';

      this._badgeRect.setFill(color, 1);
      this._badgeRect.setStroke(this._isHovered ? 2 : 1.5, 'solid', '#ffffff', 1);
      this._badgeRect.setOpacity(1);
    } else {
      const active = this._isHovered || this._isTopicHighlighted;
      const expandedFill = ColorUtil.lightenColor(color, 100);
      this._countText.peer._native.style.display = 'none';
      this._minusLine.peer._native.style.display = '';
      this._minusLine.setStroke(this._isHovered ? 2.2 : 1.8, 'solid', color, 1);

      this._badgeRect.setFill(expandedFill, 1);
      this._badgeRect.setStroke(this._isHovered ? 2.2 : 1.8, 'solid', color, 1);
      this._badgeRect.setOpacity(active ? EXPANDED_ACTIVE_OPACITY : EXPANDED_REST_OPACITY);
    }
  }

  private _centerCountTspan(): void {
    const textNative = this._countText.peer._native;
    textNative.setAttribute('text-anchor', 'middle');
    textNative.setAttribute('dominant-baseline', 'central');
    const firstTspan = textNative.firstElementChild;
    if (firstTspan) {
      firstTspan.setAttribute('dy', '0');
    }
  }

  private _layoutElements(): void {
    const offset = TopicConfig.CONNECTOR_OUTWARD_OFFSET;
    let cx = this._anchorX;
    let cy = this._anchorY;

    if (this._direction === 'down') {
      cy = this._anchorY + offset;
    } else if (this._direction === 'left') {
      cx = this._anchorX - offset;
    } else {
      cx = this._anchorX + offset;
    }

    this._stem.setFrom(this._anchorX, this._anchorY);
    this._stem.setTo(cx, cy);

    if (this._isShrink) {
      const label = formatCollapsedCount(countHiddenDescendants(this._topic));
      const pillWidth = computePillWidth(label);
      const pillHeight = TopicConfig.CONNECTOR_COLLAPSED_HEIGHT;
      this._badgeRect.setSize(pillWidth, pillHeight);
      this._badgeRect.setPosition(cx - pillWidth / 2, cy - pillHeight / 2);
      this._countText.setPosition(cx, cy);
      this._ellipse.setSize(
        Math.max(TopicConfig.CONNECTOR_HIT_SIZE, pillWidth + 10),
        TopicConfig.CONNECTOR_HIT_SIZE,
      );
    } else {
      const size = TopicConfig.CONNECTOR_WIDTH;
      this._badgeRect.setSize(size, size);
      this._badgeRect.setPosition(cx - size / 2, cy - size / 2);
      this._minusLine.setFrom(cx - MINUS_HALF_LENGTH, cy);
      this._minusLine.setTo(cx + MINUS_HALF_LENGTH, cy);
      this._ellipse.setSize(TopicConfig.CONNECTOR_HIT_SIZE, TopicConfig.CONNECTOR_HIT_SIZE);
    }

    this._ellipse.setPosition(cx, cy);
  }

  setVisibility(value: boolean, fade = 0): void {
    this._group.setVisibility(value, fade);
    if (!value) {
      this._isHovered = false;
    }
  }

  setOpacity(opacity: number): void {
    this._group.setOpacity(opacity);
  }

  addToWorkspace(group: GroupType): void {
    group.append(this._group);
  }

  /**
   * Positions the connector relative to the topic's local coordinate box.
   * Accepts the legacy `(x, y)` box-origin convention used by `TopicConnection._positionLine`
   * and derives the parent border anchor and outward direction from topic orientation.
   */
  setPosition(x: number, y: number): void {
    const halfWidth = TopicConfig.CONNECTOR_WIDTH / 2;
    const orientation = this._topic.getOrientation();

    if (orientation === 'vertical') {
      this._direction = 'down';
      this._anchorX = x + halfWidth;
      this._anchorY = y;
    } else if (x < 0) {
      this._direction = 'left';
      this._anchorX = 0;
      this._anchorY = y + halfWidth;
    } else {
      this._direction = 'right';
      this._anchorX = x;
      this._anchorY = y + halfWidth;
    }

    this._layoutElements();
  }

  moveToFront(): void {
    this._group.moveToFront();
  }
}

export default ShirinkConnector;
