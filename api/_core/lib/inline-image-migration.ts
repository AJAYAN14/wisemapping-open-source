import crypto from 'node:crypto';
import { extensionForImageMime } from './storage.js';

export interface ParsedDataImage {
  mimeType: string;
  ext: string;
  bytes: Uint8Array;
  sha256: string;
}

const DATA_IMAGE_ATTR_REGEX =
  /(\bimage\s*=\s*)(["'])([^"']*?)(data:image\/[a-z0-9.+-]+(?:;[^"']*?)?,[^"']+)\2/gi;

export function parseDataImageUri(rawUri: string): ParsedDataImage | undefined {
  const commaIdx = rawUri.indexOf(',');
  if (commaIdx === -1 || !rawUri.startsWith('data:image/')) {
    return undefined;
  }
  const header = rawUri.slice(5, commaIdx).toLowerCase();
  const payload = rawUri.slice(commaIdx + 1);
  const parts = header.split(';');
  let mimeType = (parts[0] ?? '').trim();
  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg';
  }
  const ext = extensionForImageMime(mimeType);
  if (!ext) {
    return undefined;
  }

  const isBase64 = parts.slice(1).some((p) => p.trim() === 'base64');
  let bytes: Uint8Array;
  if (isBase64) {
    const cleaned = payload.replace(/\s+/g, '');
    bytes = new Uint8Array(Buffer.from(cleaned, 'base64'));
  } else {
    try {
      bytes = new Uint8Array(Buffer.from(decodeURIComponent(payload), 'utf8'));
    } catch {
      bytes = new Uint8Array(Buffer.from(payload, 'utf8'));
    }
  }

  if (bytes.length === 0) {
    return undefined;
  }

  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  return { mimeType, ext, bytes, sha256 };
}

export async function replaceInlineImagesInXml(
  xml: string,
  uploadAsset: (asset: ParsedDataImage) => Promise<string>,
): Promise<{ xml: string; replacedCount: number; uniqueAssets: number }> {
  const matches: Array<{
    fullMatch: string;
    attrPrefix: string;
    quote: string;
    sizePrefix: string;
    dataUri: string;
    parsed: ParsedDataImage;
  }> = [];

  DATA_IMAGE_ATTR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATA_IMAGE_ATTR_REGEX.exec(xml)) !== null) {
    const [fullMatch, attrPrefix, quote, sizePrefix, dataUri] = match;
    if (!attrPrefix || !quote || !dataUri) {
      continue;
    }
    const parsed = parseDataImageUri(dataUri);
    if (!parsed) {
      continue;
    }
    matches.push({
      fullMatch,
      attrPrefix,
      quote,
      sizePrefix: sizePrefix ?? '',
      dataUri,
      parsed,
    });
  }

  if (matches.length === 0) {
    return { xml, replacedCount: 0, uniqueAssets: 0 };
  }

  const urlByHash = new Map<string, string>();
  for (const item of matches) {
    const key = `${item.parsed.sha256}.${item.parsed.ext}`;
    if (!urlByHash.has(key)) {
      const publicUrl = await uploadAsset(item.parsed);
      urlByHash.set(key, publicUrl);
    }
  }

  let replacedCount = 0;
  DATA_IMAGE_ATTR_REGEX.lastIndex = 0;
  const nextXml = xml.replace(
    DATA_IMAGE_ATTR_REGEX,
    (fullMatch, attrPrefix: string, quote: string, sizePrefix: string, dataUri: string) => {
      const parsed = parseDataImageUri(dataUri);
      if (!parsed) {
        return fullMatch;
      }
      const key = `${parsed.sha256}.${parsed.ext}`;
      const publicUrl = urlByHash.get(key);
      if (!publicUrl) {
        return fullMatch;
      }
      replacedCount += 1;
      return `${attrPrefix}${quote}${sizePrefix ?? ''}${publicUrl}${quote}`;
    },
  );

  return {
    xml: nextXml,
    replacedCount,
    uniqueAssets: urlByHash.size,
  };
}
