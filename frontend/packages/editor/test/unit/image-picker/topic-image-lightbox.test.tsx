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
import { fireEvent, render, screen } from '@testing-library/react';
import TopicImageLightbox, {
  clampZoom,
  computeFitScale,
  computeInitialScale,
} from '../../../src/components/topic-image-lightbox';
import {
  scaleTopicImageCardSize,
  scaleTopicImageUploadSize,
} from '../../../src/utils/imageAssetUtils';

const ensureBrowserPolyfills = () => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue = '') {
      this.returnValue = returnValue;
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
  if (typeof window.PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
      }
    }
    window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
  }
};

const mockRect = (el: HTMLElement, left = 0, top = 0, width = 1000, height = 700) => {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
};

describe('scaleTopicImageUploadSize & TopicImageLightbox', () => {
  beforeAll(() => {
    ensureBrowserPolyfills();
  });

  it('keeps card thumbnails compact while preserving up to 1280px for upload preview', () => {
    expect(scaleTopicImageCardSize(2560, 1440)).toEqual({ width: 150, height: 84 });
    expect(scaleTopicImageUploadSize(2560, 1440)).toEqual({ width: 1280, height: 720 });
    expect(scaleTopicImageUploadSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('computes fit and initial scales cleanly including rotated bounds', () => {
    expect(clampZoom(10)).toBe(8);
    expect(clampZoom(0.05)).toBe(0.25);
    expect(computeFitScale(0, 600, 300, 148, 0)).toBe(1);
    expect(computeFitScale(1048, 748, 2000, 1000, 0)).toBe(0.5);
    expect(computeFitScale(1048, 748, 1000, 2000, 90)).toBe(0.5);
    expect(computeInitialScale(0.5)).toBe(0.5);
    expect(computeInitialScale(2.5)).toBe(1);
  });

  it('renders nothing when preview is null', () => {
    const { container } = render(<TopicImageLightbox preview={null} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('supports zoom controls, fit/1:1 toggle, rotation, checker background, and close button', () => {
    const onClose = jest.fn();
    render(
      <TopicImageLightbox
        preview={{ url: 'https://example.com/part.webp', title: '零件示意图' }}
        onClose={onClose}
      />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: '零件示意图' });
    expect(heading).toBeTruthy();

    const img = screen.getByAltText('零件示意图') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/part.webp');
    const dialog = img.closest('dialog') as HTMLDialogElement;
    const stage = img.closest('.topic-image-lightbox__stage') as HTMLElement;
    mockRect(dialog, 0, 0, 1048, 800);

    // Before image loads, fit falls back to 1
    fireEvent.click(screen.getByRole('button', { name: '适应窗口' }));
    expect(screen.getByText('100%')).toBeTruthy();

    mockRect(stage, 0, 52, 1048, 748);
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 300 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 148 });
    fireEvent.load(img);

    expect(screen.getByText('300 × 148')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();

    // Zoom in & out
    fireEvent.click(screen.getByRole('button', { name: '放大' }));
    expect(screen.getByText('125%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '缩小' }));
    expect(screen.getByText('100%')).toBeTruthy();

    // Toggle zoom badge between 1:1 and fit
    fireEvent.click(screen.getByText('100%'));
    expect(screen.getByText('333%')).toBeTruthy();
    fireEvent.click(screen.getByText('333%'));
    expect(screen.getByText('100%')).toBeTruthy();

    // Fit button & reset button
    fireEvent.click(screen.getByRole('button', { name: '适应窗口' }));
    expect(screen.getByText('333%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重置大小' }));
    expect(screen.getByText('100%')).toBeTruthy();

    // Rotate & checker background
    fireEvent.click(screen.getByRole('button', { name: '旋转 90 度' }));
    const canvas = img.parentElement as HTMLElement;
    expect(canvas.style.transform).toContain('rotate(90deg)');

    const bgBtn = screen.getByRole('button', { name: '切换画布底色' });
    fireEvent.click(bgBtn);
    expect(img.className).toContain('topic-image-lightbox__img--checker');

    // Open in new tab link is visible for http URL
    expect(screen.getByRole('link', { name: '新标签页打开' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports wheel zoom, double-click zoom, drag pan, keyboard shortcuts, and stage light-dismiss', () => {
    const onClose = jest.fn();
    render(
      <TopicImageLightbox
        preview={{ url: 'data:image/png;base64,AAA' }}
        onClose={onClose}
      />,
    );

    expect(screen.queryByRole('link', { name: '新标签页打开' })).toBeNull();
    const img = screen.getByAltText('主题配图预览') as HTMLImageElement;
    const dialog = img.closest('dialog') as HTMLDialogElement;
    const stage = img.closest('.topic-image-lightbox__stage') as HTMLElement;
    mockRect(dialog, 0, 0, 1000, 760);
    mockRect(stage, 0, 60, 1000, 700);

    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 2000 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 1400 });
    fireEvent.load(img);

    // Wheel zoom in and clamp at MIN_ZOOM no-op branch
    fireEvent.wheel(stage, { deltaY: -100, clientX: 600, clientY: 350 });
    const canvas = img.parentElement as HTMLElement;
    expect(canvas.style.transform).not.toContain('scale(1)');

    for (let i = 0; i < 12; i += 1) {
      fireEvent.wheel(stage, { deltaY: 120, clientX: 500, clientY: 350 });
    }
    expect(screen.getByText('25%')).toBeTruthy();
    // Cover keyboard '-' no-op when already at MIN_ZOOM
    fireEvent.keyDown(dialog, { key: '-' });
    expect(screen.getByText('25%')).toBeTruthy();

    // Double-click zooms in when below/at base, then resets on second double-click
    fireEvent.doubleClick(img, { clientX: 500, clientY: 350 });
    expect(screen.getByText('200%')).toBeTruthy();
    fireEvent.doubleClick(img, { clientX: 550, clientY: 380 });
    expect(screen.getByText('47%')).toBeTruthy();

    // Non-left pointer button and stray pointerMove/Up without session are ignored
    fireEvent.pointerDown(img, { button: 2, pointerId: 9, clientX: 500, clientY: 350 });
    fireEvent.pointerMove(stage, { pointerId: 9, clientX: 540, clientY: 370 });
    fireEvent.pointerUp(stage, { pointerId: 9, clientX: 540, clientY: 370 });

    // Drag on image pans without closing
    fireEvent.pointerDown(img, { button: 0, pointerId: 1, clientX: 500, clientY: 350 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 502, clientY: 351 }); // below threshold
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 540, clientY: 370 }); // above threshold
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 540, clientY: 370 });
    expect(canvas.style.transform).toContain('translate3d(40px, 20px, 0)');
    expect(onClose).not.toHaveBeenCalled();

    // Zero-size stage guard during anchored double-click zoom
    mockRect(stage, 0, 0, 0, 0);
    fireEvent.doubleClick(img, { clientX: 500, clientY: 350 });
    mockRect(stage, 0, 60, 1000, 700);

    // Keyboard shortcuts
    fireEvent.keyDown(dialog, { key: '+' });
    fireEvent.keyDown(dialog, { key: '=' });
    fireEvent.keyDown(dialog, { key: '_' });
    fireEvent.keyDown(dialog, { key: '1' });
    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: '0' });
    fireEvent.keyDown(dialog, { key: 'r' });
    fireEvent.keyDown(dialog, { key: 'R', shiftKey: true });
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    fireEvent.keyDown(dialog, { key: 'ArrowUp' });
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'a' });

    // Click empty stage dismisses
    fireEvent.pointerDown(stage, { button: 0, pointerId: 2, clientX: 20, clientY: 120 });
    fireEvent.pointerUp(stage, { pointerId: 2, clientX: 20, clientY: 120 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports outside click fallback when closedBy is unavailable and direct close fallback when dialog is not open', () => {
    const originalDesc = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'closedBy');
    if (originalDesc) {
      delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)['closedBy'];
    }

    const onClose = jest.fn();
    const { unmount } = render(
      <TopicImageLightbox
        preview={{ url: 'https://example.com/fallback.png', title: '回退测试' }}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    mockRect(dialog, 100, 100, 400, 400);

    fireEvent.pointerDown(dialog, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(dialog, { clientX: 10, clientY: 10 });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Also cover requestClose fallback when dialog.open is false
    dialog.open = false;
    fireEvent.click(screen.getByRole('button', { name: '关闭', hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();

    if (originalDesc) {
      Object.defineProperty(HTMLDialogElement.prototype, 'closedBy', originalDesc);
    }
  });
});
