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

import type Mindmap from '../../model/Mindmap';
import type INodeModel from '../../model/INodeModel';
import { encodeUtf8, tryDecodeUtf8 } from '../../import/support/Utf8Decoder';

export type CollectedImageAsset = {
  /** Original node imageUrl (used as deduplication key). */
  sourceUrl: string;
  /** Generated filename inside the archive directory, e.g. `image-1.png`. */
  filename: string;
  /** MIME type of the image payload. */
  mimeType: string;
  /** Raw image bytes. */
  bytes: Uint8Array;
};

const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

const decodeBase64ToBytes = (base64: string): Uint8Array => {
  const cleaned = base64.replace(/\s+/g, '');
  if (!cleaned) {
    throw new Error('Base64 image payload is empty');
  }
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const detectImageFormatFromBytes = (
  bytes: Uint8Array,
): { mimeType: string; extension: string } | undefined => {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    (bytes[11] === 0x66 || bytes[11] === 0x73)
  ) {
    return { mimeType: 'image/avif', extension: 'avif' };
  }
  // Check for SVG XML prefix in ASCII
  if (bytes.length >= 4) {
    const head = (tryDecodeUtf8(bytes.subarray(0, Math.min(bytes.length, 256))) ?? '')
      .trimStart()
      .toLowerCase();
    if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
      return { mimeType: 'image/svg+xml', extension: 'svg' };
    }
  }
  return undefined;
};

const extensionFromUrlPath = (url: string): string | undefined => {
  const withoutQuery = url.split(/[?#]/, 1)[0] ?? '';
  const match = /\.([a-z0-9]{2,5})$/i.exec(withoutQuery);
  const ext = match?.[1]?.toLowerCase();
  return ext && EXTENSION_TO_MIME[ext] ? ext : undefined;
};

const parseDataUrl = (
  dataUrl: string,
): { mimeType: string; extension: string; bytes: Uint8Array } => {
  const commaIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || commaIndex === -1) {
    throw new Error('无效的 Data URL 图片数据');
  }

  const meta = dataUrl.slice(5, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const metaParts = meta.split(';').filter(Boolean);
  const isBase64 = metaParts.some((part) => part.toLowerCase() === 'base64');
  const rawMime =
    metaParts
      .find((part) => !part.includes('=') && part.toLowerCase() !== 'base64')
      ?.toLowerCase() ?? '';

  if (rawMime && !rawMime.startsWith('image/')) {
    throw new Error(`不支持的图片类型: ${rawMime}`);
  }

  let bytes: Uint8Array;
  try {
    if (isBase64) {
      bytes = decodeBase64ToBytes(payload);
    } else {
      const decoded = decodeURIComponent(payload);
      bytes = encodeUtf8(decoded);
    }
  } catch (error) {
    throw new Error(`图片数据解码失败: ${(error as Error).message}`, { cause: error });
  }

  if (bytes.length === 0) {
    throw new Error('图片数据为空');
  }

  const detected = detectImageFormatFromBytes(bytes);
  const mimeType = rawMime || detected?.mimeType || 'image/png';
  const extension = MIME_TO_EXTENSION[mimeType] || detected?.extension || 'png';
  return { mimeType, extension, bytes };
};

const fetchRemoteImage = async (
  url: string,
): Promise<{ mimeType: string; extension: string; bytes: Uint8Array }> => {
  if (typeof fetch !== 'function') {
    throw new Error(`当前运行环境不支持下载图片: ${url}`);
  }

  const isExternalHttp = url.startsWith('https://') || url.startsWith('http://');
  let response: Response;
  try {
    response = await fetch(url, isExternalHttp ? { mode: 'cors', credentials: 'omit' } : undefined);
  } catch (error) {
    throw new Error(`图片下载失败 (${url}): ${(error as Error).message}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`图片下载失败 (HTTP ${response.status}): ${url}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) {
    throw new Error(`下载的图片内容为空: ${url}`);
  }

  const headerMime = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  const detected = detectImageFormatFromBytes(bytes);

  // Reject HTML/JSON error pages returned with 200 OK when bytes are not a valid image signature
  if (
    headerMime &&
    !headerMime.startsWith('image/') &&
    headerMime !== 'application/octet-stream' &&
    !detected
  ) {
    throw new Error(`图片地址返回了非图片内容 (${headerMime}): ${url}`);
  }

  const urlExt = extensionFromUrlPath(url);
  const mimeType =
    (headerMime && MIME_TO_EXTENSION[headerMime] ? headerMime : undefined) ||
    detected?.mimeType ||
    (urlExt ? EXTENSION_TO_MIME[urlExt] : undefined) ||
    'image/png';
  const extension = MIME_TO_EXTENSION[mimeType] || detected?.extension || urlExt || 'png';

  return { mimeType, extension, bytes };
};

/** Traverses nodes in a mindmap (central topic subtree, and optionally floating branches). */
export const collectMindmapNodes = (mindmap: Mindmap, includeFloating = true): INodeModel[] => {
  const nodes: INodeModel[] = [];
  const visit = (node: INodeModel): void => {
    nodes.push(node);
    node.getChildren().forEach(visit);
  };
  const branches = includeFloating ? mindmap.getBranches() : mindmap.getBranches().slice(0, 1);
  branches.forEach(visit);
  return nodes;
};

/** Returns all unique non-empty topic imageUrls in traversal order. */
export const listMindmapImageUrls = (mindmap: Mindmap, includeFloating = true): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const node of collectMindmapNodes(mindmap, includeFloating)) {
    const url = node.getImageUrl()?.trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
};

/**
 * Resolves and deduplicates all topic raster images (`imageUrl`) in a mindmap.
 * Fails immediately if any image cannot be decoded or fetched so exports never omit assets silently.
 */
export const collectMindmapImages = async (
  mindmap: Mindmap,
  includeFloating = true,
): Promise<{ assets: CollectedImageAsset[]; bySourceUrl: Map<string, CollectedImageAsset> }> => {
  const urls = listMindmapImageUrls(mindmap, includeFloating);
  const bySourceUrl = new Map<string, CollectedImageAsset>();
  if (urls.length === 0) {
    return { assets: [], bySourceUrl };
  }

  const resolved = await Promise.all(
    urls.map(async (sourceUrl, index) => {
      const parsed = sourceUrl.startsWith('data:')
        ? parseDataUrl(sourceUrl)
        : await fetchRemoteImage(sourceUrl);
      const filename = `image-${index + 1}.${parsed.extension}`;
      const asset: CollectedImageAsset = {
        sourceUrl,
        filename,
        mimeType: parsed.mimeType,
        bytes: parsed.bytes,
      };
      return asset;
    }),
  );

  for (const asset of resolved) {
    bySourceUrl.set(asset.sourceUrl, asset);
  }
  return { assets: resolved, bySourceUrl };
};

/** Sanitizes a map title for safe file and ZIP entry naming across OSes. */
export const sanitizeExportFileName = (
  rawName: string | undefined,
  fallback = 'mindmap',
): string => {
  const trimmed = (rawName ?? '').trim();
  const withoutControls = Array.from(trimmed)
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('');
  const sanitized = withoutControls
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.+$/, '')
    .trim();
  return sanitized || fallback;
};
