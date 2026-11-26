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
  PathBuilder,
  fixed,
  formatPoint,
  fullPrecision,
  pointsData,
  unsignedFixed,
  type Vec,
} from './path';
import type { Orientation } from '../types';

/*
 * The elbow connectors of PolyLine: the straight elbow, the chamfered elbow (`Curved` and
 * `MiddleCurved`), the rounded-middle elbow (`MiddleStraight`), and the smooth rounded elbow
 * (`RoundedPolyLine`), in both orientations.
 */

/** The corner chamfer of the `Curved` style. */
export const CURVED_CHAMFER = 5;

/** The corner chamfer of the `MiddleCurved` style. */
export const MIDDLE_CURVED_CHAMFER = 10;

/** The default corner radius of the smooth rounded orthogonal elbow (`RoundedPolyLine`). */
export const ROUNDED_ELBOW_RADIUS = 12;

/**
 * A connection whose ends are at most this far apart across the layout (in y for a mind map, in x
 * for a tree) is drawn as a straight segment: a tiny jog or S-curve only reads as a wobble. Decided
 * with the user: 5 px. The elbow styles here and mindplot's curved connections share it.
 */
export const STRAIGHT_TOLERANCE_PX = 5;

/** Whether the ends of an elbow are close enough across `orientation` to draw it straight. */
export const isWithinStraightTolerance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  orientation: Orientation,
): boolean => Math.abs(orientation === 'vertical' ? x2 - x1 : y2 - y1) <= STRAIGHT_TOLERANCE_PX;

/**
 * An elbow that breaks at 50% of the distance along the main axis: 4 points, or the 2 ends when
 * they are within STRAIGHT_TOLERANCE_PX across it.
 */
export const elbowPoints = (from: Vec, to: Vec, orientation: Orientation): Vec[] => {
  if (isWithinStraightTolerance(from.x, from.y, to.x, to.y, orientation)) {
    return [from, to];
  }
  if (orientation === 'vertical') {
    const middley = from.y + (to.y - from.y) * 0.5;
    return [from, { x: from.x, y: middley }, { x: to.x, y: middley }, to];
  }
  const middlex = from.x + (to.x - from.x) * 0.5;
  return [from, { x: middlex, y: from.y }, { x: middlex, y: to.y }, to];
};

/**
 * An elbow that breaks at 50% of the distance along the main axis (x when horizontal, y when
 * vertical), with both corners chamfered by the same amount: 6 points. The chamfer is clamped to
 * half of each leg, so the line never overshoots an end nor turns back (W-HCURVE, W-VCURVE).
 * When the ends are at most STRAIGHT_TOLERANCE_PX apart across the main axis, it is the 2 ends.
 */
export const chamferedElbowPoints = (
  from: Vec,
  to: Vec,
  chamfer: number,
  orientation: Orientation,
): Vec[] => {
  if (isWithinStraightTolerance(from.x, from.y, to.x, to.y, orientation)) {
    return [from, to];
  }
  // Work in (along, across) coordinates: along the main axis, and across it.
  const vertical = orientation === 'vertical';
  const a1 = vertical ? from.y : from.x;
  const b1 = vertical ? from.x : from.y;
  const a2 = vertical ? to.y : to.x;
  const b2 = vertical ? to.x : to.y;
  const toXY = ([a, b]: [number, number]): Vec => (vertical ? { x: b, y: a } : { x: a, y: b });

  const signA = a2 < a1 ? -1 : 1;
  const signB = b2 < b1 ? -1 : 1;
  const middle = a1 + (a2 - a1) * 0.5;
  const c = Math.min(chamfer, Math.abs(a2 - a1) / 2, Math.abs(b2 - b1) / 2);

  return (
    [
      [a1, b1],
      [middle - c * signA, b1],
      [middle, b1 + c * signB],
      [middle, b2 - c * signB],
      [middle + c * signA, b2],
      [a2, b2],
    ] as [number, number][]
  ).map(toXY);
};

/** The chamfered elbow (see chamferedElbowPoints) as a `points` list, with 1 decimal. */
export const buildChamferedElbowPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  chamfer: number,
  orientation: Orientation,
): string =>
  pointsData(
    chamferedElbowPoints({ x: x1, y: y1 }, { x: x2, y: y2 }, chamfer, orientation),
    unsignedFixed(1),
  );

/**
 * The `MiddleStraight` elbow as a `points` list: the ends at full precision and the middle
 * rounded to whole units, as the legacy peer wrote it (so `-0` can appear for the middle).
 */
export const buildMiddleStraightPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  orientation: Orientation,
): string => {
  if (isWithinStraightTolerance(x1, y1, x2, y2, orientation)) {
    return pointsData(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      fullPrecision,
    );
  }
  const end1 = formatPoint({ x: x1, y: y1 }, fullPrecision, ', ');
  const end2 = formatPoint({ x: x2, y: y2 }, fullPrecision, ', ');
  if (orientation === 'vertical') {
    // For vertical tree layout: go down, then horizontal, then down
    const middley = fixed(0)((y2 - y1) * 0.5 + y1);
    return `${end1} ${x1}, ${middley} ${x2}, ${middley} ${end2}`;
  }
  // For horizontal mindmap layout: go horizontal, then vertical, then horizontal
  const middlex = fixed(0)((x2 - x1) * 0.5 + x1);
  return `${end1} ${middlex}, ${y1} ${middlex}, ${y2} ${end2}`;
};

export const buildCurvedPath = (
  _dist: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string => buildChamferedElbowPath(x1, y1, x2, y2, CURVED_CHAMFER, 'horizontal');

/** The horizontal elbow (see elbowPoints) as a `points` list, at full precision. */
export const buildStraightPath = (
  _dist: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string =>
  pointsData(elbowPoints({ x: x1, y: y1 }, { x: x2, y: y2 }, 'horizontal'), fullPrecision);

/** The vertical elbow (see elbowPoints) as a `points` list, at full precision. */
export const buildVerticalStraightPath = (
  _dist: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string => pointsData(elbowPoints({ x: x1, y: y1 }, { x: x2, y: y2 }, 'vertical'), fullPrecision);

export const buildVerticalCurvedPath = (
  _dist: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string => buildChamferedElbowPath(x1, y1, x2, y2, CURVED_CHAMFER, 'vertical');

/**
 * An orthogonal elbow connector with smooth quadratic-Bezier rounded corners (`Q`) as an SVG
 * `<path>` `d` attribute. When the ends are within `STRAIGHT_TOLERANCE_PX` across the layout axis,
 * draws a single straight segment. `middleCoord` optionally overrides the 50% bend coordinate along
 * the main axis (e.g. centering the bend in the visible gap outside a central topic box).
 */
export const buildRoundedElbowPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
  orientation: Orientation,
  middleCoord?: number,
): string => {
  const format = unsignedFixed(1);
  const builder = new PathBuilder(format);

  if (isWithinStraightTolerance(x1, y1, x2, y2, orientation)) {
    return builder.moveTo({ x: x1, y: y1 }).lineTo({ x: x2, y: y2 }).toString();
  }

  const vertical = orientation === 'vertical';
  const a1 = vertical ? y1 : x1;
  const b1 = vertical ? x1 : y1;
  const a2 = vertical ? y2 : x2;
  const b2 = vertical ? x2 : y2;
  const toXY = ([a, b]: [number, number]): Vec => (vertical ? { x: b, y: a } : { x: a, y: b });

  const middle = middleCoord !== undefined ? middleCoord : a1 + (a2 - a1) * 0.5;
  const len1 = Math.abs(middle - a1);
  const len2 = Math.abs(a2 - middle);
  const lenCross = Math.abs(b2 - b1);
  const r = Math.max(0, Math.min(radius, len1, len2, lenCross / 2));

  builder.moveTo(toXY([a1, b1]));

  if (r <= 0.01) {
    return builder
      .lineTo(toXY([middle, b1]))
      .lineTo(toXY([middle, b2]))
      .lineTo(toXY([a2, b2]))
      .toString();
  }

  const signA1 = middle >= a1 ? 1 : -1;
  const signA2 = a2 >= middle ? 1 : -1;
  const signB = b2 >= b1 ? 1 : -1;

  if (len1 > r) {
    builder.lineTo(toXY([middle - r * signA1, b1]));
  }
  builder.quadTo(toXY([middle, b1]), toXY([middle, b1 + r * signB]));

  if (lenCross > 2 * r) {
    builder.lineTo(toXY([middle, b2 - r * signB]));
  }
  builder.quadTo(toXY([middle, b2]), toXY([middle + r * signA2, b2]));

  if (len2 > r) {
    builder.lineTo(toXY([a2, b2]));
  }

  return builder.toString();
};
