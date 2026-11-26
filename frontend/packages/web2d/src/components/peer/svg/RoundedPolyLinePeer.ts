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
import * as PolyLineUtils from '../../geometry/polyline';
import ElementPeer from './ElementPeer';
import type { Orientation } from '../../types';
import type PositionType from '../../PositionType';

/**
 * Renders an orthogonal elbow connector with smooth quadratic-Bezier rounded corners as an SVG
 * `<path>` element.
 */
class RoundedPolyLinePeer extends ElementPeer<SVGPathElement> {
  private _x1: number;

  private _y1: number;

  private _x2: number;

  private _y2: number;

  private _cornerRadius: number;

  private _middleCoord: number | undefined;

  private _orientation: Orientation;

  private _pathDirty: boolean;

  constructor() {
    super(ElementPeer.createNode('path'));
    this.setFill('none');
    this.attr('stroke-linecap', 'round');
    this.attr('stroke-linejoin', 'round');
    this._x1 = 0;
    this._y1 = 0;
    this._x2 = 0;
    this._y2 = 0;
    this._cornerRadius = PolyLineUtils.ROUNDED_ELBOW_RADIUS;
    this._middleCoord = undefined;
    this._orientation = 'horizontal';
    this._pathDirty = true;
  }

  setFrom(x1: number, y1: number): void {
    const changed = this._x1 !== x1 || this._y1 !== y1;
    this._x1 = x1;
    this._y1 = y1;
    this._refreshPath(changed);
  }

  setTo(x2: number, y2: number): void {
    const changed = this._x2 !== x2 || this._y2 !== y2;
    this._x2 = x2;
    this._y2 = y2;
    this._refreshPath(changed);
  }

  getFrom(): PositionType {
    return { x: this._x1, y: this._y1 };
  }

  getTo(): PositionType {
    return { x: this._x2, y: this._y2 };
  }

  setStrokeWidth(width: number): void {
    // Through setStroke, so a dash from the style table is rescaled (BL5-77).
    this.setStroke(width);
  }

  setColor(color: string): void {
    this.attr('stroke', color);
  }

  setOrientation(orientation: Orientation): void {
    const changed = this._orientation !== orientation;
    this._orientation = orientation;
    this._refreshPath(changed);
  }

  getOrientation(): Orientation {
    return this._orientation;
  }

  setCornerRadius(radius: number): void {
    const changed = this._cornerRadius !== radius;
    this._cornerRadius = radius;
    this._refreshPath(changed);
  }

  getCornerRadius(): number {
    return this._cornerRadius;
  }

  setMiddleCoord(coord: number | undefined): void {
    const changed = this._middleCoord !== coord;
    this._middleCoord = coord;
    this._refreshPath(changed);
  }

  getMiddleCoord(): number | undefined {
    return this._middleCoord;
  }

  private _refreshPath(changed: boolean): void {
    if (changed) {
      this._pathDirty = true;
    }
    if (this._pathDirty) {
      this._pathDirty = false;
      this._updatePath();
    }
  }

  private _updatePath(): void {
    const d = PolyLineUtils.buildRoundedElbowPath(
      this._x1,
      this._y1,
      this._x2,
      this._y2,
      this._cornerRadius,
      this._orientation,
      this._middleCoord,
    );
    this.attr('d', d);
  }
}

export default RoundedPolyLinePeer;
