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

export const ALLOWED_TOPIC_IMAGE_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const MAX_TOPIC_IMAGE_INPUT_BYTES = 15 * 1024 * 1024;
export const MAX_TOPIC_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface CompressedTopicImage {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
}

export const scaleTopicImageCardSize = (
  origW: number,
  origH: number,
): { width: number; height: number } => {
  const safeW = Number.isFinite(origW) && origW > 0 ? origW : 130;
  const safeH = Number.isFinite(origH) && origH > 0 ? origH : 90;
  const maxW = 150;
  const maxH = 100;
  const scale = Math.min(maxW / safeW, maxH / safeH, 1.0);
  return {
    width: Math.max(Math.round(safeW * scale), 80),
    height: Math.max(Math.round(safeH * scale), 50),
  };
};

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode image as Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'));
    reader.readAsDataURL(blob);
  });

const normalizeImageMime = (rawMime: string): string => {
  const lower = rawMime.trim().toLowerCase();
  return lower === 'image/jpg' ? 'image/jpeg' : lower;
};

/**
 * Normalizes and downscales oversized topic images to crisp 2x card resolution
 * in WebP format so both Supabase Storage (1 GB) and egress (5 GB/mo) stay lean.
 */
export const compressTopicImage = async (file: Blob): Promise<CompressedTopicImage> => {
  const mimeType = normalizeImageMime(file.type || 'image/png');
  if (!ALLOWED_TOPIC_IMAGE_TYPES.has(mimeType)) {
    throw new Error('仅支持 PNG、JPG、WebP、GIF 或 SVG 图片格式。');
  }
  if (file.size <= 0) {
    throw new Error('图片文件为空。');
  }
  if (file.size > MAX_TOPIC_IMAGE_INPUT_BYTES) {
    throw new Error('原始图片不能超过 15 MB。');
  }

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Image === 'undefined') {
    if (file.size > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
      throw new Error('压缩后图片仍超过 5 MB 上限。');
    }
    return {
      blob: file,
      mimeType,
      width: 130,
      height: 90,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('无法解析该图片文件。'));
      el.src = objectUrl;
    });

    const cardSize = scaleTopicImageCardSize(img.naturalWidth, img.naturalHeight);
    if (
      mimeType !== 'image/svg+xml' &&
      mimeType !== 'image/gif' &&
      (file.size > 32 * 1024 || img.naturalWidth > 320 || img.naturalHeight > 220)
    ) {
      const canvas = document.createElement('canvas');
      canvas.width = cardSize.width * 2;
      canvas.height = cardSize.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/webp', 0.85);
        });
        const finalBlob =
          compressedBlob && compressedBlob.type === 'image/webp'
            ? compressedBlob
            : await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/png');
              });

        if (finalBlob && finalBlob.size > 0 && finalBlob.size <= file.size) {
          if (finalBlob.size > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
            throw new Error('图片压缩后仍超过 5 MB 上限。');
          }
          return {
            blob: finalBlob,
            mimeType: finalBlob.type || 'image/webp',
            ...cardSize,
          };
        }
      }
    }

    if (file.size > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
      throw new Error('图片文件超过 5 MB 上限。');
    }

    return {
      blob: file,
      mimeType,
      ...cardSize,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
