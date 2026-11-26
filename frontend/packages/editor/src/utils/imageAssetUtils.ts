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
import { encodeImageDataToAvif } from './avifEncoder';

export const ALLOWED_TOPIC_IMAGE_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
]);

export const AVIF_CONVERTIBLE_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const AVIF_CONVERT_MIN_BYTES = 150 * 1024;
// Supabase Storage Free tier global ceiling (enforced only after AVIF transcoding).
export const MAX_TOPIC_IMAGE_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface CompressedTopicImage {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
}

export interface AvifConversionResult {
  blob: Blob;
  mimeType: string;
  converted: boolean;
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

export const normalizeImageMime = (rawMime: string): string => {
  const lower = rawMime.trim().toLowerCase();
  return lower === 'image/jpg' ? 'image/jpeg' : lower;
};

export const isAvifConvertibleMime = (rawMime: string): boolean =>
  AVIF_CONVERTIBLE_TYPES.has(normalizeImageMime(rawMime));

export const shouldConvertBlobToAvif = (rawMime: string, byteLength: number): boolean => {
  const mime = normalizeImageMime(rawMime);
  if (mime === 'image/gif') {
    return true;
  }
  return AVIF_CONVERTIBLE_TYPES.has(mime) && byteLength >= AVIF_CONVERT_MIN_BYTES;
};

export const replaceFilenameExtension = (
  filename: string | undefined,
  nextExt: string,
  fallbackBase = 'image',
): string => {
  const cleanName = filename?.trim() || `${fallbackBase}.${nextExt}`;
  const dotIdx = cleanName.lastIndexOf('.');
  const base = dotIdx > 0 ? cleanName.slice(0, dotIdx) : cleanName;
  return `${base}.${nextExt}`;
};

const loadHtmlImageFromBlob = async (blob: Blob): Promise<HTMLImageElement> => {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    throw new Error('当前运行环境不支持图片解码。');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('无法解析该图片文件。'));
      el.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const extractImageDataFromElement = (
  img: HTMLImageElement,
): { data: Uint8ClampedArray; width: number; height: number } => {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('无法读取图片原始分辨率，无法执行 AVIF 转码。');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 2D 画布上下文以解码图片像素。');
  }
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return {
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
  };
};

const validateTopicImageInput = (blob: Blob): string => {
  const mimeType = normalizeImageMime(blob.type || 'image/png');
  if (mimeType === 'image/svg+xml') {
    throw new Error('不支持 SVG 格式图片，已放弃上传。');
  }
  if (!ALLOWED_TOPIC_IMAGE_TYPES.has(mimeType)) {
    throw new Error('仅支持 PNG、JPG、WebP、AVIF 或 GIF 图片格式。');
  }
  if (blob.size <= 0) {
    throw new Error('图片文件为空。');
  }
  return mimeType;
};

/**
 * Converts GIFs (always -> static first frame) and PNG/JPEG/WebP >= 150 KB to
 * visually-lossless AVIF without downscaling dimensions. Input size is uncapped prior
 * to transcoding; only the final output must fit within the 50 MB storage ceiling.
 * Throws strictly on any decode/encode failure rather than silently falling back.
 */
export const convertBlobToAvifIfEligible = async (
  blob: Blob,
  options?: { preloadedImage?: HTMLImageElement },
): Promise<AvifConversionResult> => {
  const mimeType = validateTopicImageInput(blob);

  if (!shouldConvertBlobToAvif(mimeType, blob.size)) {
    if (blob.size > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
      throw new Error('图片文件超过云端存储 50 MB 上限。');
    }
    return {
      blob,
      mimeType,
      converted: false,
    };
  }

  const img = options?.preloadedImage ?? (await loadHtmlImageFromBlob(blob));
  const imageData = extractImageDataFromElement(img);
  const avifBytes = await encodeImageDataToAvif(imageData);

  // For GIF, always output static AVIF to drop animation; for PNG/JPEG/WebP, keep original if AVIF isn't smaller.
  if (mimeType !== 'image/gif' && avifBytes.byteLength >= blob.size) {
    if (blob.size > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
      throw new Error('图片文件超过云端存储 50 MB 上限。');
    }
    return {
      blob,
      mimeType,
      converted: false,
    };
  }

  if (avifBytes.byteLength > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
    throw new Error('转码后的 AVIF 图片仍超过云端存储 50 MB 上限。');
  }

  const exactCopy = new Uint8Array(avifBytes.byteLength);
  exactCopy.set(avifBytes);
  return {
    blob: new Blob([exactCopy.buffer], { type: 'image/avif' }),
    mimeType: 'image/avif',
    converted: true,
  };
};

/**
 * Validates a topic image, calculates its compact card display size, and converts
 * GIF (static) or >= 150 KB static images to AVIF without resizing original dimensions.
 */
export const compressTopicImage = async (file: Blob): Promise<CompressedTopicImage> => {
  const mimeType = validateTopicImageInput(file);

  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    if (shouldConvertBlobToAvif(mimeType, file.size)) {
      throw new Error('当前运行环境不支持 AVIF 图片转码。');
    }
    if (file.size > MAX_TOPIC_IMAGE_UPLOAD_BYTES) {
      throw new Error('图片文件超过云端存储 50 MB 上限。');
    }
    return {
      blob: file,
      mimeType,
      width: 130,
      height: 90,
    };
  }

  const img = await loadHtmlImageFromBlob(file);
  const cardSize = scaleTopicImageCardSize(img.naturalWidth, img.naturalHeight);
  const converted = await convertBlobToAvifIfEligible(file, { preloadedImage: img });

  return {
    blob: converted.blob,
    mimeType: converted.mimeType,
    ...cardSize,
  };
};
