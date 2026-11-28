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

const MIME_TO_EXT: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const URL_EXT_REGEX = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i;

const sanitizeBaseName = (rawTitle?: string): string => {
  const cleaned = (rawTitle ?? '')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
  return cleaned || 'topic-image';
};

export const buildImageDownloadFilename = (
  title: string | undefined,
  mimeType: string | undefined,
  url: string,
): string => {
  const normalizedMime = mimeType?.split(';')[0]?.trim().toLowerCase() ?? '';
  let ext = MIME_TO_EXT[normalizedMime];
  if (!ext && !url.startsWith('data:')) {
    const match = URL_EXT_REGEX.exec(url);
    if (match?.[1]) {
      const candidate = match[1].toLowerCase();
      ext = candidate === 'jpeg' ? 'jpg' : candidate;
    }
  }
  return `${sanitizeBaseName(title)}.${ext ?? 'png'}`;
};

const fetchImageBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url, url.startsWith('data:') ? undefined : { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`加载图片失败 (${response.status})`);
  }
  const blob = await response.blob();
  if (blob.size <= 0) {
    throw new Error('图片内容为空');
  }
  return blob;
};

const loadImageElementFromBlob = async (blob: Blob): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('无法解码图片像素'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const convertImageBlobToPng = async (blob: Blob): Promise<Blob> => {
  if (blob.type.toLowerCase() === 'image/png') {
    return blob;
  }

  let width: number;
  let height: number;
  let source: CanvasImageSource;
  let bitmap: ImageBitmap | undefined;

  if (typeof createImageBitmap === 'function') {
    bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    source = bitmap;
  } else {
    const img = await loadImageElementFromBlob(blob);
    width = img.naturalWidth;
    height = img.naturalHeight;
    source = img;
  }

  try {
    if (width <= 0 || height <= 0) {
      throw new Error('无法获取图片尺寸');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建画布上下文');
    }
    ctx.drawImage(source, 0, 0, width, height);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/png');
    });
    if (!pngBlob) {
      throw new Error('图片转换为 PNG 失败');
    }
    return pngBlob;
  } finally {
    bitmap?.close?.();
  }
};

export const convertImageUrlToPngBlob = async (url: string): Promise<Blob> => {
  let blob: Blob;
  try {
    blob = await fetchImageBlob(url);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('该外链图片受跨域限制无法直接复制，请尝试下载或在灯箱新标签页打开', {
        cause: err,
      });
    }
    throw err;
  }
  return convertImageBlobToPng(blob);
};

export const copyImageToClipboard = async (url: string): Promise<void> => {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    throw new Error('当前浏览器不支持直接写入图片到剪贴板，请使用「下载图片」');
  }

  // Pass the Promise<Blob> into ClipboardItem synchronously inside the user gesture
  // so Safari/iOS WebKit keeps clipboard write authorization alive across async conversion.
  const pngPromise = convertImageUrlToPngBlob(url);
  try {
    const item = new ClipboardItem({ 'image/png': pngPromise });
    await navigator.clipboard.write([item]);
  } catch (err) {
    // Fallback for environments whose ClipboardItem constructor expects a resolved Blob.
    if (err instanceof TypeError) {
      const resolved = await pngPromise;
      const item = new ClipboardItem({ 'image/png': resolved });
      await navigator.clipboard.write([item]);
      return;
    }
    throw err;
  }
};

export const copyTextToClipboard = async (text: string): Promise<void> => {
  if (!text) {
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to execCommand fallback if clipboard API rejects.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('当前环境不支持剪贴板写入');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) {
    throw new Error('无法复制文本到剪贴板');
  }
};

const triggerAnchorDownload = (href: string, filename: string, openBlankFallback = false): void => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  if (openBlankFallback) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const downloadTopicImage = async (url: string, title?: string): Promise<void> => {
  try {
    const blob = await fetchImageBlob(url);
    const filename = buildImageDownloadFilename(title, blob.type, url);
    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerAnchorDownload(objectUrl, filename);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  } catch {
    const fallbackName = buildImageDownloadFilename(title, undefined, url);
    triggerAnchorDownload(url, fallbackName, true);
  }
};
