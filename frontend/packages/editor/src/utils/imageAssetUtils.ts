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

export const MAX_TOPIC_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;

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
 * Validates a topic image and calculates its compact card display size without
 * re-encoding or compressing the original image bytes.
 */
export const compressTopicImage = async (file: Blob): Promise<CompressedTopicImage> => {
  const mimeType = normalizeImageMime(file.type || 'image/png');
  if (!ALLOWED_TOPIC_IMAGE_TYPES.has(mimeType)) {
    throw new Error('仅支持 PNG、JPG、WebP、GIF 或 SVG 图片格式。');
  }
  if (file.size <= 0) {
    throw new Error('图片文件为空。');
  }
  if (file.size > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
    throw new Error('图片文件不能超过 20 MB。');
  }

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Image === 'undefined') {
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
    return {
      blob: file,
      mimeType,
      ...cardSize,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
