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

export interface AvifEncodeOptions {
  quality: number;
  qualityAlpha: number;
  denoiseLevel: number;
  tileRowsLog2: number;
  tileColsLog2: number;
  speed: number;
  subsample: number;
  chromaDeltaQ: boolean;
  sharpness: number;
  enableSharpYUV: boolean;
  tune: number;
}

export interface AvifWorkerResponse {
  id: number;
  buffer?: ArrayBuffer;
  error?: string;
}

export const AVIF_WORKER_URL = '/codecs/avif/avif-worker.js';

/**
 * Visually-lossless high-quality AVIF preset derived from Squoosh libavif options:
 * quality=82 + SSIM tuning + SharpYUV chroma downsampling to keep screenshot text crisp.
 */
export const DEFAULT_AVIF_ENCODE_OPTIONS: AvifEncodeOptions = {
  quality: 82,
  qualityAlpha: -1,
  denoiseLevel: 0,
  tileColsLog2: 0,
  tileRowsLog2: 0,
  speed: 6,
  subsample: 1,
  chromaDeltaQ: false,
  sharpness: 0,
  enableSharpYUV: true,
  tune: 2,
};

interface PendingEncodeRequest {
  resolve: (bytes: Uint8Array) => void;
  reject: (err: Error) => void;
}

let cachedWorker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingEncodeRequest>();

const rejectAllPending = (error: Error): void => {
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
  if (cachedWorker) {
    cachedWorker.terminate?.();
    cachedWorker = null;
  }
};

const getOrCreateAvifWorker = (): Worker => {
  if (cachedWorker) {
    return cachedWorker;
  }
  if (typeof Worker === 'undefined') {
    throw new Error('当前浏览器不支持 AVIF 转码（Web Worker 不可用）。');
  }

  const worker = new Worker(AVIF_WORKER_URL, { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<AvifWorkerResponse>) => {
    const payload = event.data;
    if (!payload || typeof payload.id !== 'number') {
      return;
    }
    const pending = pendingRequests.get(payload.id);
    if (!pending) {
      return;
    }
    pendingRequests.delete(payload.id);

    if (payload.error) {
      pending.reject(new Error(`AVIF 图片转码失败: ${payload.error}`));
      return;
    }
    if (!payload.buffer || payload.buffer.byteLength === 0) {
      pending.reject(new Error('AVIF 图片转码失败: 输出结果为空。'));
      return;
    }
    pending.resolve(new Uint8Array(payload.buffer));
  });

  worker.addEventListener('error', (event: ErrorEvent) => {
    const detail = event.message ? `: ${event.message}` : '';
    rejectAllPending(new Error(`AVIF 转码工作线程异常${detail}`));
  });

  cachedWorker = worker;
  return worker;
};

/**
 * Encodes raw RGBA pixels into AVIF bytes inside a reusable Web Worker backed by libavif WASM.
 */
export const encodeImageDataToAvif = (
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  options: AvifEncodeOptions = DEFAULT_AVIF_ENCODE_OPTIONS,
): Promise<Uint8Array> => {
  const worker = getOrCreateAvifWorker();
  const id = nextRequestId++;
  // Copy into a dedicated buffer so transferring never mutates or detaches caller memory.
  const rgbaCopy = new Uint8ClampedArray(imageData.data);

  return new Promise<Uint8Array>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    try {
      worker.postMessage(
        {
          id,
          rgbaBuffer: rgbaCopy.buffer,
          width: imageData.width,
          height: imageData.height,
          options,
        },
        [rgbaCopy.buffer],
      );
    } catch (err) {
      pendingRequests.delete(id);
      reject(err instanceof Error ? err : new Error('向 AVIF 转码工作线程发送图片数据失败。'));
    }
  });
};

export const resetAvifWorkerForTests = (): void => {
  rejectAllPending(new Error('AVIF worker reset'));
  nextRequestId = 1;
};
