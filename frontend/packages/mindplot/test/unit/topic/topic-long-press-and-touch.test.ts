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
import { isObjectTouch } from '../../../src/components/util/objectTouch';
import type { Harness } from '../commands/designer-harness';
import { buildDesigner, SAMPLE_MAP } from '../commands/designer-harness';

jest.mock('../../../src/components/export/PDFExporter', () => ({
  __esModule: true,
  default: class MockPDFExporter {},
}));

const nativeOf = (element: unknown): SVGElement =>
  (element as { peer: { _native: SVGElement } }).peer._native;

const groupOf = (topic: Topic): SVGElement => nativeOf(topic.get2DElement());

type TouchPoint = { clientX: number; clientY: number };

const touchEvent = (type: string, touches: TouchPoint[]): Event => {
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

describe('Topic touch long-press edit & mobile ergonomics', () => {
  it('opens the inline text editor after a stationary long-press and keeps it open past emulated mouse events', async () => {
    const harness = await open();
    jest.useFakeTimers();

    const topic = harness.topic(3);
    const group = groupOf(topic);
    const cancelPanSpy = jest.spyOn(harness.designer.getWorkSpace(), 'cancelPan');

    group.dispatchEvent(touchEvent('touchstart', [{ clientX: 50, clientY: 60 }]));
    expect(harness.designer.getTextEditor().isActive()).toBe(false);

    jest.advanceTimersByTime(450);

    expect(cancelPanSpy).toHaveBeenCalled();
    expect(topic.isOnFocus()).toBe(true);
    expect(harness.designer.getTextEditor().getActiveTopic()).toBe(topic);

    // Lifting the finger and synthetic browser mouse events must not dismiss the newly opened editor.
    window.dispatchEvent(touchEvent('touchend', []));
    group.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    group.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(harness.designer.getTextEditor().getActiveTopic()).toBe(topic);
  });

  it('cancels long-press edit when the finger moves beyond tolerance (single-finger pan)', async () => {
    const harness = await open();
    jest.useFakeTimers();

    const topic = harness.topic(3);
    const group = groupOf(topic);

    group.dispatchEvent(touchEvent('touchstart', [{ clientX: 50, clientY: 60 }]));
    window.dispatchEvent(touchEvent('touchmove', [{ clientX: 80, clientY: 60 }]));
    jest.advanceTimersByTime(500);

    expect(harness.designer.getTextEditor().isActive()).toBe(false);
    window.dispatchEvent(touchEvent('touchend', []));
  });

  it('cancels long-press edit when a second finger lands (pinch gesture)', async () => {
    const harness = await open();
    jest.useFakeTimers();

    const topic = harness.topic(3);
    const group = groupOf(topic);

    group.dispatchEvent(touchEvent('touchstart', [{ clientX: 50, clientY: 60 }]));
    window.dispatchEvent(
      touchEvent('touchmove', [
        { clientX: 50, clientY: 60 },
        { clientX: 120, clientY: 120 },
      ]),
    );
    jest.advanceTimersByTime(500);

    expect(harness.designer.getTextEditor().isActive()).toBe(false);
    window.dispatchEvent(touchEvent('touchend', []));
  });

  it('marks touchstart on ShrinkConnector as an object touch so tapping it does not deselect', async () => {
    const harness = await open();
    const topic = harness.topic(1);
    const shrinkConnector = topic.getShrinkConnector();
    expect(shrinkConnector).toBeDefined();

    const ellipse = (shrinkConnector as unknown as { _ellipse: { peer: { _native: SVGElement } } })
      ._ellipse.peer._native;
    const event = touchEvent('touchstart', [{ clientX: 10, clientY: 10 }]);
    ellipse.dispatchEvent(event);

    expect(isObjectTouch(event)).toBe(true);
  });

  it('hides keyboard shortcut keycaps inside action pills and expands touch padding on touch/mobile devices', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    try {
      const harness = await open();
      const leaf = harness.topic(3);
      leaf.setOnFocus(true);

      const shadow = harness.designer.getSelectionShadows().get(leaf) as unknown as {
        _rightPlus: HTMLDivElement & {
          _pillState: { badge: HTMLSpanElement; labelSpan: HTMLSpanElement; kbdSpan: HTMLSpanElement };
        };
      };
      expect(shadow._rightPlus._pillState.kbdSpan.style.display).toBe('none');
      expect(shadow._rightPlus._pillState.labelSpan.textContent).toBe('子主题');
      expect(shadow._rightPlus.style.minHeight).toBe('36px');
      expect(shadow._rightPlus._pillState.badge.style.width).toBe('22px');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('edits the currently focused topic via designer.editSelectedTopic()', async () => {
    const harness = await open();
    expect(harness.designer.editSelectedTopic()).toBe(false);

    const topic = harness.topic(3);
    topic.setOnFocus(true);
    expect(harness.designer.editSelectedTopic()).toBe(true);
    expect(harness.designer.getTextEditor().getActiveTopic()).toBe(topic);
  });
});
