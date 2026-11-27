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

import Canvas from '../../src/components/Canvas';
import ScreenManager from '../../src/components/ScreenManager';
import LayoutEventBus from '../../src/components/layout/LayoutEventBus';

describe('Canvas GPU pan preview', () => {
  let divContainer: HTMLDivElement;
  let screenManager: ScreenManager;
  let bus: LayoutEventBus;
  let canvas: Canvas;
  let rafQueue: FrameRequestCallback[];
  let originalRaf: typeof globalThis.requestAnimationFrame;
  let originalCancelRaf: typeof globalThis.cancelAnimationFrame;

  beforeEach(() => {
    rafQueue = [];
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;

    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    };

    globalThis.cancelAnimationFrame = (id: number) => {
      if (id >= 1 && id <= rafQueue.length) {
        rafQueue[id - 1] = () => undefined;
      }
    };

    divContainer = document.createElement('div');
    Object.defineProperty(divContainer, 'offsetWidth', { configurable: true, value: 1000 });
    Object.defineProperty(divContainer, 'offsetHeight', { configurable: true, value: 800 });
    document.body.appendChild(divContainer);

    screenManager = new ScreenManager(divContainer);
    bus = new LayoutEventBus();
    canvas = new Canvas(screenManager, 1.0, false, false, bus);
    canvas.registerEvents();
  });

  afterEach(() => {
    canvas.dispose();
    divContainer.remove();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
  });

  const flushRaf = () => {
    const callbacks = rafQueue.splice(0, rafQueue.length);
    callbacks.forEach((cb) => cb(performance.now()));
  };

  it('coalesces middle-mouse mousemove events into one rAF GPU preview and commits on mouseup', () => {
    const workspace = (canvas as unknown as {
      _workspace: {
        getSVGElement: () => SVGSVGElement;
        _getHtmlContainer: () => HTMLElement;
      };
    })._workspace;

    const previewEvents: Array<{ active: boolean; dx: number; dy: number }> = [];
    const pannedSpy = jest.fn();
    const updateSpy = jest.fn();
    bus.addEvent('canvasPanPreview', (payload) => previewEvents.push(payload));
    bus.addEvent('canvasPanned', pannedSpy);
    screenManager.addEvent('update', updateSpy);

    const startOrigin = canvas.getCoordOrigin();

    divContainer.dispatchEvent(
      new MouseEvent('mousedown', { button: 1, clientX: 200, clientY: 200, bubbles: true }),
    );
    // Multiple mousemoves within the same frame before rAF runs
    window.document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 220, clientY: 210, bubbles: true }),
    );
    window.document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 260, clientY: 230, bubbles: true }),
    );

    expect(rafQueue).toHaveLength(1);
    expect(previewEvents).toEqual([]);

    flushRaf();

    // Only the latest delta (60, 30) was applied via GPU translate3d directly on <svg> behind an O(1) drag shield
    const shield = divContainer.querySelector<HTMLDivElement>('[data-pan-shield="true"]');
    expect(shield?.style.display).toBe('block');
    expect(shield?.style.cursor).toBe('move');
    expect(workspace.getSVGElement().style.transform).toBe('translate3d(60px, 30px, 0)');
    expect(previewEvents).toEqual([{ active: true, dx: 60, dy: 30 }]);
    // Update fired once on drag start to close editors; canvasPanned deferred until commit/reanchor
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(pannedSpy).not.toHaveBeenCalled();

    // Subsequent mousemove past last rAF, then mouseup commits final delta
    window.document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 290, clientY: 250, bubbles: true }),
    );
    window.document.dispatchEvent(new MouseEvent('mouseup', { button: 1, bubbles: true }));

    expect(shield?.style.display).toBe('none');
    expect(workspace.getSVGElement().style.transform).toBe('');
    expect(workspace.getSVGElement().getAttribute('width')).toBe('1640');
    expect(canvas.getCoordOrigin()).toEqual({
      x: startOrigin.x - 90,
      y: startOrigin.y - 50,
    });
    expect(previewEvents[previewEvents.length - 1]).toEqual({ active: false, dx: 0, dy: 0 });
    expect(pannedSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });

  it('commits pending pan delta even when mouseup arrives before the first rAF tick', () => {
    const startOrigin = canvas.getCoordOrigin();
    const pannedSpy = jest.fn();
    bus.addEvent('canvasPanned', pannedSpy);

    divContainer.dispatchEvent(
      new MouseEvent('mousedown', { button: 1, clientX: 100, clientY: 100, bubbles: true }),
    );
    window.document.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 145, clientY: 125, bubbles: true }),
    );
    window.document.dispatchEvent(new MouseEvent('mouseup', { button: 1, bubbles: true }));

    expect(canvas.getCoordOrigin()).toEqual({
      x: startOrigin.x - 45,
      y: startOrigin.y - 25,
    });
    expect(pannedSpy).toHaveBeenCalledTimes(1);
  });
});
