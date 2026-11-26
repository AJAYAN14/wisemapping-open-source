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
import WorkspaceElement from './WorkspaceElement';
import type Line from './Line';
import type PositionType from './PositionType';
import type { ElementAttributes } from './StyleAttributes';
import RoundedPolyLinePeer from './peer/svg/RoundedPolyLinePeer';
import type { ElementType, Orientation } from './types';

/**
 * Orthogonal elbow connector with smooth rounded corners (`<path>` element).
 */
class RoundedPolyLine extends WorkspaceElement<RoundedPolyLinePeer> implements Line {
  constructor(attributes?: ElementAttributes) {
    const peer = new RoundedPolyLinePeer();
    const defaultAttributes: ElementAttributes = {
      strokeColor: 'blue',
      strokeWidth: 1,
      strokeStyle: 'solid',
      strokeOpacity: 1,
      fill: 'none 0',
    };

    const mergedAttr = { ...defaultAttributes, ...attributes };
    super(peer, mergedAttr);
  }

  getElementClass(): RoundedPolyLine {
    return this;
  }

  getTo(): PositionType {
    return this.peer.getTo();
  }

  getFrom(): PositionType {
    return this.peer.getFrom();
  }

  getType(): ElementType {
    return 'RoundedPolyLine';
  }

  setFrom(x: number, y: number): void {
    this.peer.setFrom(x, y);
  }

  setTo(x: number, y: number): void {
    this.peer.setTo(x, y);
  }

  setOrientation(orientation: Orientation): void {
    this.peer.setOrientation(orientation);
  }

  getOrientation(): Orientation {
    return this.peer.getOrientation();
  }

  setCornerRadius(radius: number): void {
    this.peer.setCornerRadius(radius);
  }

  getCornerRadius(): number {
    return this.peer.getCornerRadius();
  }

  setMiddleCoord(coord: number | undefined): void {
    this.peer.setMiddleCoord(coord);
  }

  getMiddleCoord(): number | undefined {
    return this.peer.getMiddleCoord();
  }
}

export default RoundedPolyLine;
