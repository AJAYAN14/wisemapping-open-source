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
import Client, { AssetUploadUrlItem, AssetUploadUrlRequest } from '../classes/client';

const DATA_IMAGE_ATTR_REGEX =
  /(\bimage\s*=\s*)(["'])([^"']*?)(data:image\/[a-z0-9.+-]+(?:;[^"']*?)?,[^"']+)\2/gi;

const SUPPORTED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const UPLOAD_BATCH_SIZE = 100;
const UPLOAD_CONCURRENCY = 8;

export type ExternalizeImageProgress = {
  phase: 'signing' | 'uploading' | 'done';
  totalImages: number;
  uploadTotal: number;
  uploadedCount: number;
  reusedCount: number;
};

const normalizeMime = (rawMime: string): string => {
  const lower = rawMime.trim().toLowerCase();
  return lower === 'image/jpg' ? 'image/jpeg' : lower;
};

const decodeDataImageUri = (
  rawUri: string,
): { mimeType: string; bytes: Uint8Array } | undefined => {
  const commaIdx = rawUri.indexOf(',');
  if (commaIdx === -1 || !rawUri.startsWith('data:image/')) {
    return undefined;
  }
  const header = rawUri.slice(5, commaIdx).toLowerCase();
  const payload = rawUri.slice(commaIdx + 1);
  const parts = header.split(';');
  const mimeType = normalizeMime(parts[0] ?? '');
  if (!SUPPORTED_MIMES.has(mimeType)) {
    return undefined;
  }

  const isBase64 = parts.slice(1).some((p) => p.trim() === 'base64');
  let bytes: Uint8Array;
  if (isBase64) {
    const cleaned = payload.replace(/\s+/g, '');
    const binary = atob(cleaned);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    const decoded = decodeURIComponent(payload);
    bytes = new TextEncoder().encode(decoded);
  }

  return bytes.length > 0 ? { mimeType, bytes } : undefined;
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string | undefined> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return undefined;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const uploadBlobToSignedUrl = async (
  signedUrl: string,
  blob: Blob,
  mimeType: string,
): Promise<void> => {
  const formData = new FormData();
  formData.append('cacheControl', '31536000');
  formData.append('', new Blob([blob], { type: mimeType }));

  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`上传图片到云端存储失败 (${response.status}): ${errText || response.statusText}`);
  }
};

export const uploadBlobToMapAssets = async (
  client: Client,
  blob: Blob,
): Promise<string | undefined> => {
  if (!client.requestAssetUploadUrls) {
    return undefined;
  }
  const mimeType = normalizeMime(blob.type || 'image/png');
  if (!SUPPORTED_MIMES.has(mimeType)) {
    throw new Error('仅支持 PNG、JPG、WebP、GIF 或 SVG 图片格式。');
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const sha256 = await sha256Hex(bytes);
  if (!sha256) {
    return undefined;
  }

  const items = await client.requestAssetUploadUrls([{ sha256, mimeType, size: bytes.length }]);
  const target = items[0];
  if (!target) {
    throw new Error('无法获取图片上传凭证。');
  }
  if (!target.exists && target.signedUrl) {
    await uploadBlobToSignedUrl(target.signedUrl, blob, mimeType);
  }
  return target.publicUrl;
};

/**
 * Extracts inline `data:image/...` attributes from an imported mindmap XML string,
 * uploads unique blobs directly to Supabase Storage (`map-assets`), and rewrites
 * the XML attributes to short public CDN URLs before saving to PostgreSQL.
 */
export const externalizeXmlInlineImages = async (
  xml: string,
  client: Client,
  onProgress?: (progress: ExternalizeImageProgress) => void,
): Promise<string> => {
  if (!client.requestAssetUploadUrls || !xml.includes('data:image/')) {
    return xml;
  }

  type ExtractedEntry = {
    sha256: string;
    mimeType: string;
    bytes: Uint8Array;
  };

  const assetsByKey = new Map<string, ExtractedEntry>();
  const dataUriToKey = new Map<string, string>();

  DATA_IMAGE_ATTR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATA_IMAGE_ATTR_REGEX.exec(xml)) !== null) {
    const dataUri = match[4];
    if (!dataUri || dataUriToKey.has(dataUri)) {
      continue;
    }
    const decoded = decodeDataImageUri(dataUri);
    if (!decoded) {
      continue;
    }
    const sha256 = await sha256Hex(decoded.bytes);
    if (!sha256) {
      return xml;
    }
    const key = `${sha256}:${decoded.mimeType}`;
    dataUriToKey.set(dataUri, key);
    if (!assetsByKey.has(key)) {
      assetsByKey.set(key, {
        sha256,
        mimeType: decoded.mimeType,
        bytes: decoded.bytes,
      });
    }
  }

  if (assetsByKey.size === 0) {
    return xml;
  }

  const entries = Array.from(assetsByKey.entries());
  const resolvedByKey = new Map<string, AssetUploadUrlItem>();

  try {
    onProgress?.({
      phase: 'signing',
      totalImages: entries.length,
      uploadTotal: entries.length,
      uploadedCount: 0,
      reusedCount: 0,
    });

    for (let i = 0; i < entries.length; i += UPLOAD_BATCH_SIZE) {
      const slice = entries.slice(i, i + UPLOAD_BATCH_SIZE);
      const reqItems: AssetUploadUrlRequest[] = slice.map(([, entry]) => ({
        sha256: entry.sha256,
        mimeType: entry.mimeType,
        size: entry.bytes.length,
      }));
      const issued = await client.requestAssetUploadUrls(reqItems);
      const issuedByHash = new Map(issued.map((item) => [item.sha256, item]));
      for (const [key, entry] of slice) {
        const item = issuedByHash.get(entry.sha256);
        if (item) {
          resolvedByKey.set(key, item);
        }
      }
    }

    const toUpload = entries.filter(([key]) => {
      const item = resolvedByKey.get(key);
      return item && !item.exists && item.signedUrl;
    });
    const reusedCount = entries.length - toUpload.length;
    let uploadedCount = 0;

    if (toUpload.length > 0) {
      onProgress?.({
        phase: 'uploading',
        totalImages: entries.length,
        uploadTotal: toUpload.length,
        uploadedCount: 0,
        reusedCount,
      });
    }

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < toUpload.length) {
        const idx = cursor++;
        const pair = toUpload[idx];
        if (!pair) {
          continue;
        }
        const [key, entry] = pair;
        const item = resolvedByKey.get(key);
        if (!item?.signedUrl) {
          continue;
        }
        const bufCopy = new Uint8Array(entry.bytes.byteLength);
        bufCopy.set(entry.bytes);
        const blob = new Blob([bufCopy.buffer], { type: entry.mimeType });
        await uploadBlobToSignedUrl(item.signedUrl, blob, entry.mimeType);
        uploadedCount += 1;
        onProgress?.({
          phase: 'uploading',
          totalImages: entries.length,
          uploadTotal: toUpload.length,
          uploadedCount,
          reusedCount,
        });
      }
    };

    const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, toUpload.length) }, () =>
      worker(),
    );
    await Promise.all(workers);

    onProgress?.({
      phase: 'done',
      totalImages: entries.length,
      uploadTotal: toUpload.length,
      uploadedCount: toUpload.length,
      reusedCount,
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    // If Storage service key is not configured yet on backend, degrade gracefully rather than blocking import
    if (status === 503) {
      console.warn('Storage not configured on backend; keeping inline images:', err);
      return xml;
    }
    throw err;
  }

  DATA_IMAGE_ATTR_REGEX.lastIndex = 0;
  return xml.replace(
    DATA_IMAGE_ATTR_REGEX,
    (fullMatch, attrPrefix: string, quote: string, sizePrefix: string, dataUri: string) => {
      const key = dataUriToKey.get(dataUri);
      if (!key) {
        return fullMatch;
      }
      const item = resolvedByKey.get(key);
      if (!item?.publicUrl) {
        return fullMatch;
      }
      return `${attrPrefix}${quote}${sizePrefix ?? ''}${item.publicUrl}${quote}`;
    },
  );
};
