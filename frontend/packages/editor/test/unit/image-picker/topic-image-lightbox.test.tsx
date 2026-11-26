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
  AVIF_CONVERT_MIN_BYTES,
  compressTopicImage,
  convertBlobToAvifIfEligible,
  isAvifConvertibleMime,
  MAX_TOPIC_IMAGE_UPLOAD_BYTES,
  replaceFilenameExtension,
  scaleTopicImageCardSize,
  shouldConvertBlobToAvif,
} from '../../../src/utils/imageAssetUtils';
import { encodeImageDataToAvif, resetAvifWorkerForTests } from '../../../src/utils/avifEncoder';

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

describe('TopicImageLightbox', () => {
  beforeAll(() => {
    ensureBrowserPolyfills();
  });

  it('keeps card thumbnails compact', () => {
    expect(scaleTopicImageCardSize(2560, 1440)).toEqual({ width: 150, height: 84 });
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
    render(<TopicImageLightbox preview={{ url: 'data:image/png;base64,AAA' }} onClose={onClose} />);

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

  it('skips < 150 KB static images, converts GIF to static AVIF, rejects SVG, and checks 50 MB ceiling post-transcode', async () => {
    const smallBlob = new Blob([new Uint8Array(100 * 1024)], { type: 'image/png' });
    const smallGifBlob = new Blob([new Uint8Array(12 * 1024)], { type: 'image/gif' });
    const largeBlob = new Blob([new Uint8Array(200 * 1024)], { type: 'image/png' });
    const hugeInputBlob = {
      size: 60 * 1024 * 1024,
      type: 'image/png',
    } as Blob;
    const svgBlob = new Blob([new Uint8Array(1024)], { type: 'image/svg+xml' });
    const prevCreateObjectUrl = URL.createObjectURL;
    const prevRevokeObjectUrl = URL.revokeObjectURL;
    const prevImage = globalThis.Image;
    const prevWorker = globalThis.Worker;
    const prevCreateElement = document.createElement.bind(document);

    URL.createObjectURL = jest.fn(() => 'blob:mock-image');
    URL.revokeObjectURL = jest.fn();

    class MockImage {
      naturalWidth = 2560;
      naturalHeight = 1440;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const el = prevCreateElement(tagName);
      if (tagName.toLowerCase() === 'canvas') {
        (el as HTMLCanvasElement).getContext = jest.fn(() => ({
          drawImage: jest.fn(),
          getImageData: jest.fn((_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(16),
          })),
        })) as unknown as HTMLCanvasElement['getContext'];
      }
      return el;
    }) as typeof document.createElement);

    let nextAvifBytes = new Uint8Array(40 * 1024);
    let nextWorkerError: string | undefined;
    let triggerWorkerCrash = false;

    class MockWorker {
      private listeners = new Map<string, Array<(event: unknown) => void>>();

      addEventListener(type: string, cb: (event: unknown) => void) {
        const list = this.listeners.get(type) ?? [];
        list.push(cb);
        this.listeners.set(type, list);
      }

      postMessage(data: { id: number }) {
        queueMicrotask(() => {
          if (triggerWorkerCrash) {
            for (const cb of this.listeners.get('error') ?? []) {
              cb({ message: 'wasm OOM' });
            }
            return;
          }
          for (const cb of this.listeners.get('message') ?? []) {
            if (nextWorkerError) {
              cb({ data: { id: data.id, error: nextWorkerError } });
            } else {
              cb({ data: { id: data.id, buffer: nextAvifBytes.slice().buffer } });
            }
          }
        });
      }

      terminate = jest.fn();
    }
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    try {
      expect(AVIF_CONVERT_MIN_BYTES).toBe(150 * 1024);
      expect(MAX_TOPIC_IMAGE_UPLOAD_BYTES).toBe(50 * 1024 * 1024);
      expect(isAvifConvertibleMime('image/jpg')).toBe(true);
      expect(isAvifConvertibleMime('image/gif')).toBe(true);
      expect(isAvifConvertibleMime('image/svg+xml')).toBe(false);
      expect(shouldConvertBlobToAvif('image/gif', 1024)).toBe(true);
      expect(shouldConvertBlobToAvif('image/png', 100 * 1024)).toBe(false);
      expect(replaceFilenameExtension('screenshot.png', 'avif')).toBe('screenshot.avif');
      expect(replaceFilenameExtension(undefined, 'avif', 'pasted')).toBe('pasted.avif');

      // 1. Small PNG (< 150 KB) stays untouched
      const preparedSmall = await compressTopicImage(smallBlob);
      expect(preparedSmall.blob).toBe(smallBlob);
      expect(preparedSmall.mimeType).toBe('image/png');
      expect(preparedSmall.width).toBe(150);
      expect(preparedSmall.height).toBe(84);

      // 2. SVG is rejected and never uploaded
      await expect(compressTopicImage(svgBlob)).rejects.toThrow(/SVG/);
      await expect(convertBlobToAvifIfEligible(svgBlob)).rejects.toThrow(/SVG/);

      // 3. GIF (even < 150 KB and even when static AVIF > GIF size) is always converted to static AVIF
      const preparedGif = await compressTopicImage(smallGifBlob);
      expect(preparedGif.mimeType).toBe('image/avif');
      expect(preparedGif.blob.size).toBe(40 * 1024);

      // 4. Large PNG (>= 150 KB) converts to AVIF when smaller
      const preparedLarge = await compressTopicImage(largeBlob);
      expect(preparedLarge.mimeType).toBe('image/avif');
      expect(preparedLarge.blob.size).toBe(40 * 1024);
      expect(preparedLarge.width).toBe(150);
      expect(preparedLarge.height).toBe(84);

      // 5. Over-20MB (even 60MB) input is NOT blocked upfront if AVIF output fits within 50 MB
      const preparedHuge = await compressTopicImage(hugeInputBlob);
      expect(preparedHuge.mimeType).toBe('image/avif');
      expect(preparedHuge.blob.size).toBe(40 * 1024);

      // 6. If AVIF output is larger or equal (for non-GIF), keep original blob
      nextAvifBytes = new Uint8Array(220 * 1024);
      const keptOriginal = await convertBlobToAvifIfEligible(largeBlob);
      expect(keptOriginal.converted).toBe(false);
      expect(keptOriginal.blob).toBe(largeBlob);
      expect(keptOriginal.mimeType).toBe('image/png');

      // 7. Worker encoding errors abort strictly instead of silently falling back
      nextWorkerError = 'encode failed';
      await expect(compressTopicImage(largeBlob)).rejects.toThrow(/AVIF 图片转码失败/);
      nextWorkerError = undefined;

      // 8. Worker crash rejects all pending encodings
      triggerWorkerCrash = true;
      await expect(
        encodeImageDataToAvif({ data: new Uint8ClampedArray(16), width: 2, height: 2 }),
      ).rejects.toThrow(/AVIF 转码工作线程异常/);
      triggerWorkerCrash = false;

      // 9. Missing Worker rejects strictly for >= 150 KB images
      resetAvifWorkerForTests();
      Object.defineProperty(globalThis, 'Worker', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      await expect(compressTopicImage(largeBlob)).rejects.toThrow(/Web Worker/);

      // 10. Post-fallback original > 50 MB storage ceiling still fails cleanly
      nextAvifBytes = new Uint8Array(40 * 1024);
      const oversizedAvif = {
        size: MAX_TOPIC_IMAGE_UPLOAD_BYTES + 1,
        type: 'image/avif',
      } as Blob;
      await expect(compressTopicImage(oversizedAvif)).rejects.toThrow(/50 MB/);
    } finally {
      resetAvifWorkerForTests();
      jest.restoreAllMocks();
      URL.createObjectURL = prevCreateObjectUrl;
      URL.revokeObjectURL = prevRevokeObjectUrl;
      globalThis.Image = prevImage;
      globalThis.Worker = prevWorker;
    }
  });
});
