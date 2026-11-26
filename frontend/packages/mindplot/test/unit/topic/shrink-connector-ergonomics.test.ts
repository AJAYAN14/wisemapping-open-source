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

import type Topic from '../../../src/components/Topic';
import TopicConfig from '../../../src/components/TopicConfig';
import { isObjectTouch } from '../../../src/components/util/objectTouch';
import type { Harness } from '../commands/designer-harness';
import { buildDesigner, SAMPLE_MAP } from '../commands/designer-harness';

jest.mock('../../../src/components/export/PDFExporter', () => ({
  __esModule: true,
  default: class MockPDFExporter {},
}));

type ConnectorInternals = {
  _ellipse: { peer: { _native: SVGEllipseElement } };
  _badgeRect: { peer: { _native: SVGRectElement } };
  _minusLine: { peer: { _native: SVGLineElement } };
  _countText: { peer: { _native: SVGTextElement }; getText: () => string };
  _stem: { peer: { _native: SVGLineElement } };
};

const internalsOf = (topic: Topic): ConnectorInternals =>
  topic.getShrinkConnector() as unknown as ConnectorInternals;

const touchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches });
  Object.defineProperty(event, 'changedTouches', { value: touches });
  return event;
};

const harnesses: Harness[] = [];
const open = async (xml = SAMPLE_MAP) => {
  const harness = await buildDesigner(xml);
  harnesses.push(harness);
  harness.designer.deselectAll();
  return harness;
};

afterEach(() => {
  harnesses.splice(0).forEach((harness) => harness.designer.dispose());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ShrinkConnector Plan A ergonomics & UI', () => {
  it('separates the visual badge from the node border and exposes a 28x28px pointer hit target', async () => {
    const harness = await open();
    const parent = harness.topic(1);
    const { _ellipse, _badgeRect, _stem } = internalsOf(parent);

    const hit = _ellipse.peer._native;
    expect(hit.style.cursor).toBe('pointer');
    expect(hit.getAttribute('rx')).toBe(String(TopicConfig.CONNECTOR_HIT_SIZE / 2));
    expect(hit.getAttribute('ry')).toBe(String(TopicConfig.CONNECTOR_HIT_SIZE / 2));

    // Positioned outward from the node edge so the 14px circle does not touch the node border.
    const size = parent.getSize();
    const cx = Number(hit.getAttribute('cx'));
    expect(Math.abs(cx - size.width)).toBe(TopicConfig.CONNECTOR_OUTWARD_OFFSET);

    const stemX1 = Number(_stem.peer._native.getAttribute('x1'));
    const stemX2 = Number(_stem.peer._native.getAttribute('x2'));
    expect(stemX1).toBe(size.width);
    expect(stemX2).toBe(cx);

    expect(_badgeRect.peer._native.style.pointerEvents).toBe('none');
    expect(hit.style.pointerEvents).toBe('all');
  });

  it('toggles between expanded minus circle and collapsed descendant count pill', async () => {
    const harness = await open();
    const parent = harness.topic(1);
    const { _ellipse, _minusLine, _countText, _badgeRect } = internalsOf(parent);

    expect(_minusLine.peer._native.style.display).toBe('');
    expect(_countText.peer._native.style.display).toBe('none');

    // Click to collapse
    _ellipse.peer._native.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    _ellipse.peer._native.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );

    expect(parent.areChildrenShrunken()).toBe(true);
    expect(_minusLine.peer._native.style.display).toBe('none');
    expect(_countText.peer._native.style.display).toBe('');
    expect(_countText.getText()).toBe(String(parent.getChildren().length));
    expect(Number(_badgeRect.peer._native.getAttribute('height'))).toBe(
      TopicConfig.CONNECTOR_COLLAPSED_HEIGHT,
    );

    // Click to expand again
    _ellipse.peer._native.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    _ellipse.peer._native.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );

    expect(parent.areChildrenShrunken()).toBe(false);
    expect(_minusLine.peer._native.style.display).toBe('');
    expect(_countText.peer._native.style.display).toBe('none');
  });

  it('ignores click after pointer drag beyond tolerance and isolates node selection/long-press edit', async () => {
    const harness = await open();
    jest.useFakeTimers();

    const parent = harness.topic(1);
    const { _ellipse } = internalsOf(parent);
    const hit = _ellipse.peer._native;

    // Mouse drag > 6px does not toggle collapse
    hit.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    hit.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 25, clientY: 10 }),
    );
    expect(parent.areChildrenShrunken()).toBe(false);
    expect(parent.isOnFocus()).toBe(false);

    // Touch hold on connector marks object touch and never triggers Topic long-press inline editor
    const tEvent = touchEvent('touchstart', [{ clientX: 10, clientY: 10 }]);
    hit.dispatchEvent(tEvent);
    expect(isObjectTouch(tEvent)).toBe(true);

    jest.advanceTimersByTime(500);
    expect(harness.designer.getTextEditor().isActive()).toBe(false);
    window.dispatchEvent(touchEvent('touchend', []));
  });
});
