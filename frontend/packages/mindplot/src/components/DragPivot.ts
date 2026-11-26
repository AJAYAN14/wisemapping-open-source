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
import {
  Point,
  CurvedLine,
  Rect,
  defaultControlPoints,
  isWithinStraightTolerance,
} from '@wisemapping/web2d';
import { $assert } from './util/assert';
import type PositionType from './PositionType';

import type SizeType from './SizeType';
import type Topic from './Topic';
import Shape from './util/Shape';
import type Canvas from './Canvas';
import type CanvasElement from './CanvasElement';

const DEFAULT_PREVIEW_ACCENT = '#ec4899';

class DragPivot implements CanvasElement {
  private _position: PositionType;

  private _isVisible: boolean;

  private _targetTopic: Topic | undefined;

  private _connectRect: Rect;

  private _dragPivot: Rect;

  private _curvedLine: CurvedLine;

  private _straightLine: CurvedLine;

  private _size: SizeType;

  private _isInWorkspace: boolean;

  constructor() {
    this._position = { x: 0, y: 0 };
    this._size = DragPivot.DEFAULT_PIVOT_SIZE;

    this._straightLine = this._buildPreviewLine();
    this._curvedLine = this._buildPreviewLine();
    this._dragPivot = this._buildPivotPill();
    this._connectRect = this._buildConnectHalo();
    this._targetTopic = undefined;
    this._isVisible = false;
    this._isInWorkspace = false;
  }

  isVisible(): boolean {
    return this._isVisible;
  }

  getTargetTopic(): Topic | undefined {
    return this._targetTopic;
  }

  private _buildPreviewLine(): CurvedLine {
    const line = new CurvedLine();
    // Keep width < 1 so CurvedLine draws an open stroked path rather than a closed tapered outline.
    line.setWidth(0);
    line.setFill('none');
    line.setStroke(2, 'dash', DEFAULT_PREVIEW_ACCENT, 0.72);
    line.setVisibility(false);
    return line;
  }

  private _redrawLine(): void {
    // Update line position.
    $assert(this.getTargetTopic(), 'Illegal invocation. Target node can not be null');

    const pivotRect = this._getPivotRect();

    // Pivot position has not changed. In this case, position change is not required.
    const targetTopic = this.getTargetTopic();
    const position = this._position;

    // Calculate pivot connection point ...
    const size = this._size;
    const targetPosition = targetTopic!.getPosition();
    const line = this._getConnectionLine();

    // Update Line position based on orientation
    const orientation = targetTopic!.getOrientation();
    let pivotPoint: PositionType;

    if (orientation === 'vertical') {
      // Tree layout: connect from top center of pivot (going up to parent)
      pivotPoint = {
        x: position.x,
        y: position.y - size.height / 2,
      };
    } else {
      // Mindmap layout: connect from left or right side
      const isAtRight = Shape.isAtRight(targetPosition, position);
      pivotPoint = Shape.calculateRectConnectionPoint(position, size, isAtRight);
    }

    line?.setFrom(pivotPoint.x, pivotPoint.y);

    // Update rect position
    const cx = position.x - size.width / 2;
    const cy = position.y - size.height / 2;
    pivotRect.setPosition(cx, cy);

    // Make line visible only when the position has been already changed.
    // This solve several strange effects ;)
    const targetPoint = targetTopic!.workoutIncomingConnectionPoint(pivotPoint);
    line?.setTo(targetPoint.x, targetPoint.y);

    // Set control points based on orientation
    if (line) {
      // Ends at (almost) the same height, as TopicConnection draws it: control points on the
      // chord, so the line is straight.
      if (
        isWithinStraightTolerance(
          pivotPoint.x,
          pivotPoint.y,
          targetPoint.x,
          targetPoint.y,
          orientation,
        )
      ) {
        const [src, dest] = defaultControlPoints(pivotPoint, targetPoint);
        line.setSrcControlPoint(new Point(src.x, src.y));
        line.setDestControlPoint(new Point(dest.x, dest.y));
      } else if (orientation === 'vertical') {
        // Vertical orientation: control points based on Y distance
        const deltaY = (targetPoint.y - pivotPoint.y) / 3;
        line.setSrcControlPoint(new Point(0, deltaY));
        line.setDestControlPoint(new Point(0, -deltaY));
      } else {
        // Horizontal orientation: control points based on X distance
        const deltaX = (targetPoint.x - pivotPoint.x) / 3;
        line.setSrcControlPoint(new Point(deltaX, 0));
        line.setDestControlPoint(new Point(-deltaX, 0));
      }
    }
  }

  setPosition(point: Point): void {
    this._position = point;
    this._redrawLine();
  }

  getPosition(): PositionType {
    return this._position;
  }

  private _buildPivotPill(): Rect {
    const size = this._size;
    const rect = new Rect(0.6, {
      fillColor: DEFAULT_PREVIEW_ACCENT,
      fillOpacity: 0.28,
      width: size.width,
      height: size.height,
      stroke: `1.5 solid ${DEFAULT_PREVIEW_ACCENT}`,
      strokeOpacity: 0.95,
    });
    rect.setVisibility(false);
    return rect;
  }

  private _buildConnectHalo(): Rect {
    const size = this._size;
    const rect = new Rect(0.5, {
      fillColor: DEFAULT_PREVIEW_ACCENT,
      fillOpacity: 0.14,
      width: size.width,
      height: size.height,
      stroke: `2 solid ${DEFAULT_PREVIEW_ACCENT}`,
      strokeOpacity: 0.82,
    });
    rect.setVisibility(false);
    return rect;
  }

  private _resolveAccentColor(targetTopic: Topic): string {
    const maybeTopic = targetTopic as unknown as {
      getThemeVariant?: () => 'light' | 'dark';
      getConnectionColor?: (variant: 'light' | 'dark') => string;
    };
    const variant =
      typeof maybeTopic.getThemeVariant === 'function' ? maybeTopic.getThemeVariant() : 'light';
    const color =
      typeof maybeTopic.getConnectionColor === 'function'
        ? maybeTopic.getConnectionColor(variant)
        : undefined;
    return color || DEFAULT_PREVIEW_ACCENT;
  }

  private _getPivotRect(): Rect {
    return this._dragPivot;
  }

  getSize(): SizeType {
    const elem2d = this._getPivotRect();
    return elem2d.getSize();
  }

  setVisibility(value: boolean) {
    if (this.isVisible() !== value) {
      // Hide all visual elements
      this._getPivotRect().setVisibility(value);
      this._connectRect.setVisibility(value);
      this._straightLine.setVisibility(value);
      this._curvedLine.setVisibility(value);

      this._isVisible = value;
    }
  }

  // If the node is connected, validate that there is a line connecting both...
  _getConnectionLine(): CurvedLine | undefined {
    // Always use straight line for drag preview
    return this._targetTopic ? this._straightLine : undefined;
  }

  addToWorkspace(workspace: Canvas) {
    // Only add elements once - prevent duplicate additions
    if (this._isInWorkspace) {
      return;
    }

    const pivotRect = this._getPivotRect();
    workspace.append(pivotRect);

    // Add a hidden straight line ...
    const straighLine = this._straightLine;
    straighLine.setVisibility(false);
    workspace.append(straighLine);
    straighLine.moveToBack();

    // Add a hidden curved line ...
    const curvedLine = this._curvedLine;
    curvedLine.setVisibility(false);
    workspace.append(curvedLine);
    curvedLine.moveToBack();

    // Add a connect rect ...
    const connectRect = this._connectRect;
    connectRect.setVisibility(false);
    workspace.append(connectRect);
    connectRect.moveToBack();

    this._isInWorkspace = true;
  }

  removeFromWorkspace(workspace: Canvas) {
    if (!this._isInWorkspace) {
      return;
    }

    const shape = this._getPivotRect();
    workspace.removeChild(shape);

    const connectToRect = this._connectRect;
    workspace.removeChild(connectToRect);

    workspace.removeChild(this._straightLine);
    workspace.removeChild(this._curvedLine);

    this._isInWorkspace = false;
  }

  connectTo(targetTopic: Topic, position: PositionType) {
    $assert(position, 'position can not be null');
    $assert(targetTopic, 'parent can not be null');

    this._position = position;
    this._targetTopic = targetTopic;

    const accentColor = this._resolveAccentColor(targetTopic);

    // Highlight halo around the candidate parent topic with rounded corners.
    const connectRect = this._connectRect;
    const targetSize = targetTopic.getSize();
    const haloPadding = 10;
    const width = targetSize.width + haloPadding;
    const height = targetSize.height + haloPadding;

    connectRect.setFill(accentColor, 0.14);
    connectRect.setStroke(2, 'solid', accentColor, 0.82);
    connectRect.setSize(width, height);

    const targetPosition = targetTopic.getPosition();
    const cx = Math.ceil(targetPosition.x - width / 2);
    const cy = Math.ceil(targetPosition.y - height / 2);
    connectRect.setPosition(cx, cy);

    // Style drop slot pill and dashed preview line with the same branch accent color.
    const pivotRect = this._getPivotRect();
    pivotRect.setFill(accentColor, 0.28);
    pivotRect.setStroke(1.5, 'solid', accentColor, 0.95);
    pivotRect.moveToFront();

    this._straightLine.setStroke(2, 'dash', accentColor, 0.72);
    this._curvedLine.setStroke(2, 'dash', accentColor, 0.72);

    // Position the pivot pill centered at the predicted drop position.
    const size = this._size;
    const pivotX = position.x - size.width / 2;
    const pivotY = position.y - size.height / 2;
    pivotRect.setPosition(pivotX, pivotY);

    this._redrawLine();
  }

  disconnect(workspace: Canvas): void {
    $assert(workspace, 'workspace can not be null.');
    $assert(this._targetTopic, 'There are not connected topic.');

    this.setVisibility(false);
    this._targetTopic = undefined;
  }

  /**
   * Reset the pivot state (useful when changing layouts)
   */
  reset(): void {
    this.setVisibility(false);
    this._targetTopic = undefined;
    // Note: Don't reset _isInWorkspace - elements stay in workspace,
    // just hidden and disconnected
  }

  static DEFAULT_PIVOT_SIZE = { width: 40, height: 18 };
}

export default DragPivot;
