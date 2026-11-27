import type { MapPreview, MapPreviewBranch } from '../classes/client';

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function readAttr(tagAttrs: string, attrName: string): string | undefined {
  const regex = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = regex.exec(tagAttrs);
  if (!match) {
    return undefined;
  }
  return decodeXmlEntities(match[1] ?? match[2] ?? '').trim();
}

function truncateLabel(text: string, maxLen = 18): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLen - 1)}…`;
}

export function extractMapPreview(xml: string, fallbackTitle = ''): MapPreview {
  if (!xml) {
    return {
      centralTopic: truncateLabel(fallbackTitle || '中心主题', 22),
      branches: [],
      topicCount: 0,
    };
  }

  const mapTagMatch = /<map\b([^>]*)>/i.exec(xml);
  const theme = mapTagMatch ? readAttr(mapTagMatch[1] ?? '', 'theme') : undefined;

  const tokenRegex = /<\/topic\s*>|<topic\b([^>]*?)(\/?)>/gi;
  let depth = 0;
  let topicCount = 0;
  let centralTopic = '';
  const branches: MapPreviewBranch[] = [];

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(xml)) !== null) {
    const token = match[0];
    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    const attrs = match[1] ?? '';
    const selfClosing = match[2] === '/';
    const currentDepth = depth;
    topicCount += 1;

    const text = readAttr(attrs, 'text') ?? '';
    const isCentral = readAttr(attrs, 'central') === 'true';

    if ((currentDepth === 0 || isCentral) && !centralTopic) {
      centralTopic = truncateLabel(text || fallbackTitle || '中心主题', 22);
    } else if (currentDepth === 1 && branches.length < 6) {
      const position = readAttr(attrs, 'position') ?? '';
      const side: 'left' | 'right' | undefined = position.startsWith('-')
        ? 'left'
        : position
          ? 'right'
          : undefined;
      const bgColor = readAttr(attrs, 'bgColor');
      branches.push({
        text: truncateLabel(text || '分支主题', 14),
        ...(side ? { side } : {}),
        ...(bgColor ? { color: bgColor } : {}),
      });
    }

    if (!selfClosing) {
      depth += 1;
    }
  }

  return {
    centralTopic: centralTopic || truncateLabel(fallbackTitle || '中心主题', 22),
    branches,
    ...(theme ? { theme } : {}),
    topicCount,
  };
}

export function getUtf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length;
}

export function formatMapSize(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}
