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

import type { CurvedLine } from '@wisemapping/web2d';
import { Group } from '@wisemapping/web2d';
import type Canvas from '../../src/components/Canvas';
import DragPivot from '../../src/components/DragPivot';
import type PositionType from '../../src/components/PositionType';
import type Topic from '../../src/components/Topic';
import { STRAIGHT_TOLERANCE_PX } from '../../src/components/TopicConnection';

/**
 * The drag preview line is drawn straight when its ends are at most STRAIGHT_TOLERANCE_PX apart
 * across the layout, as TopicConnection draws the curved connections (BL5-75).
 */
const lineTo = (across: number) => {
  // The parent is at the origin; its incoming point is where the line ends.
  const target = {
    getPosition: () => ({ x: 0, y: 0 }),
    getSize: () => ({ width: 100, height: 40 }),
    getOrientation: () => 'horizontal' as const,
    workoutIncomingConnectionPoint: (): PositionType => ({ x: 50, y: 0 }),
  } as unknown as Topic;
  const pivot = new DragPivot();
  const group = new Group();
  pivot.addToWorkspace({
    append: (element: CurvedLine) => group.append(element),
  } as unknown as Canvas);
  // The pivot connection point is `across` away from the parent's incoming point, across the layout in y.
  const position = { x: 200 + DragPivot.DEFAULT_PIVOT_SIZE.width / 2, y: across };
  pivot.connectTo(target, position);
  const line = (pivot as unknown as { _straightLine: CurvedLine })._straightLine;
  const from = line.getFrom();
  const to = line.getTo();
  return { from, to, controls: line.getControlPoints() };
};

describe('DragPivot line (BL5-75)', () => {
  it('horizontal: straight within the tolerance, curved beyond it', () => {
    [0, STRAIGHT_TOLERANCE_PX, -STRAIGHT_TOLERANCE_PX].forEach((across) => {
      const { from, to, controls } = lineTo(across);
      expect(from.y - to.y).toBe(across);
      // Control points on the chord: a straight segment.
      const chord = { x: to.x - from.x, y: to.y - from.y };
      expect(controls[0].x).toBeCloseTo(chord.x / 3);
      expect(controls[0].y).toBeCloseTo(chord.y / 3);
      expect(controls[1].x).toBeCloseTo(-chord.x / 3);
      expect(controls[1].y).toBeCloseTo(-chord.y / 3);
    });

    [STRAIGHT_TOLERANCE_PX + 1, -(STRAIGHT_TOLERANCE_PX + 1)].forEach((across) => {
      const { controls } = lineTo(across);
      // Control points along the layout axis only: an S-curve.
      expect(controls[0].y).toBe(0);
      expect(controls[1].y).toBe(0);
    });
  });

  it('uses rounded pill/halo corners and follows target topic connection color', () => {
    const target = {
      getPosition: () => ({ x: 0, y: 0 }),
      getSize: () => ({ width: 100, height: 40 }),
      getOrientation: () => 'horizontal' as const,
      getThemeVariant: () => 'light' as const,
      getConnectionColor: () => '#3b82f6',
      workoutIncomingConnectionPoint: (): PositionType => ({ x: 50, y: 0 }),
    } as unknown as Topic;

    const pivot = new DragPivot();
    const group = new Group();
    pivot.addToWorkspace({
      append: (element: CurvedLine) => group.append(element),
    } as unknown as Canvas);
    pivot.connectTo(target, { x: 200, y: 0 });

    const internals = pivot as unknown as {
      _dragPivot: { peer: { _native: SVGRectElement } };
      _connectRect: { peer: { _native: SVGRectElement } };
      _straightLine: { peer: { _native: SVGPathElement } };
    };

    expect(internals._dragPivot.peer._native.getAttribute('width')).toBe('54');
    expect(internals._dragPivot.peer._native.getAttribute('height')).toBe('32');
    expect(internals._dragPivot.peer._native.getAttribute('rx')).toBe('8');
    expect(internals._connectRect.peer._native.getAttribute('rx')).toBe('8');
    expect(internals._dragPivot.peer._native.getAttribute('fill')).toBe('#3b82f6');
    expect(internals._connectRect.peer._native.getAttribute('stroke')).toBe('#3b82f6');
    expect(internals._straightLine.peer._native.getAttribute('stroke')).toBe('#3b82f6');
    expect(internals._straightLine.peer._native.getAttribute('fill')).toBe('none');
    expect(internals._straightLine.peer._native.getAttribute('d')).not.toContain('Z');
  });
});
