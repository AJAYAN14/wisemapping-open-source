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
import RoundedPolyLine from '../../src/components/RoundedPolyLine';
import RoundedPolyLinePeer from '../../src/components/peer/svg/RoundedPolyLinePeer';
import { ROUNDED_ELBOW_RADIUS } from '../../src/components/geometry/polyline';

describe('RoundedPolyLinePeer', () => {
  it('renders an SVG <path> with round caps/joins and 12px default radius', () => {
    const peer = new RoundedPolyLinePeer();
    expect(peer._native.localName).toBe('path');
    expect(peer._native.getAttribute('fill')).toBe('none');
    expect(peer._native.getAttribute('stroke-linecap')).toBe('round');
    expect(peer._native.getAttribute('stroke-linejoin')).toBe('round');
    expect(peer.getCornerRadius()).toBe(ROUNDED_ELBOW_RADIUS);

    peer.setFrom(0, 0);
    peer.setTo(100, 100);
    expect(peer._native.getAttribute('d')).toBe(
      'M0.0,0.0 L38.0,0.0 Q50.0,0.0 50.0,12.0 L50.0,88.0 Q50.0,100.0 62.0,100.0 L100.0,100.0',
    );
  });

  it('updates path when orientation, cornerRadius or middleCoord changes', () => {
    const line = new RoundedPolyLine();
    expect(line.getType()).toBe('RoundedPolyLine');
    line.setFrom(0, 0);
    line.setTo(100, 100);
    line.setOrientation('vertical');
    line.setCornerRadius(8);
    line.setMiddleCoord(60);

    expect(line.getFrom()).toEqual({ x: 0, y: 0 });
    expect(line.getTo()).toEqual({ x: 100, y: 100 });
    expect(line.getOrientation()).toBe('vertical');
    expect(line.getCornerRadius()).toBe(8);
    expect(line.getMiddleCoord()).toBe(60);
    expect(line.peer._native.getAttribute('d')).toBe(
      'M0.0,0.0 L0.0,52.0 Q0.0,60.0 8.0,60.0 L92.0,60.0 Q100.0,60.0 100.0,68.0 L100.0,100.0',
    );
  });
});
