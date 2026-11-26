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

const NO_LINE_START = /^[，。、；：！？）》】」』’”、.,;:!?)\]}%‰°℃]$/;
const NO_LINE_END = /^[（《【「『“‘([{]$/;
const ASCII_TOKEN = /^[A-Za-z0-9_]+$/;
const WIDE_CHAR = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE6F\uFF00-\uFFEF]/;

let measureCanvasContext: CanvasRenderingContext2D | null | undefined;

const getMeasureContext = (): CanvasRenderingContext2D | null => {
  if (measureCanvasContext !== undefined) {
    return measureCanvasContext;
  }
  if (
    typeof document === 'undefined' ||
    (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))
  ) {
    measureCanvasContext = null;
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    measureCanvasContext = canvas.getContext('2d');
  } catch {
    measureCanvasContext = null;
  }
  return measureCanvasContext;
};

/**
 * Builds a line-width measurer matching the SVG `<text>` font specification.
 * Uses Canvas 2D `measureText` in browsers and falls back to deterministic character
 * metrics in headless DOM environments (e.g. jsdom).
 */
export const createTextMeasurer = (
  fontFamily: string,
  graphSize: string,
  style: string,
  weight: string,
): ((line: string) => number) => {
  const fontSize = Number.parseFloat(graphSize) || 13.4;
  const ctx = getMeasureContext();
  if (ctx) {
    const fontString = `${style} ${weight} ${fontSize}px ${fontFamily || 'sans-serif'}`;
    return (line: string): number => {
      ctx.font = fontString;
      return ctx.measureText(line).width;
    };
  }

  return (line: string): number => {
    let total = 0;
    for (const ch of line) {
      total += WIDE_CHAR.test(ch) ? fontSize : fontSize * 0.6;
    }
    return total;
  };
};

/**
 * Splits a paragraph into wrap-friendly tokens:
 * - Latin words/numbers stay intact so English words do not break mid-word.
 * - Opening punctuation attaches to the following token (no orphan open bracket at EOL).
 * - Closing/trailing punctuation attaches to the preceding token (no orphan punctuation at SOL).
 */
const tokenizeForWrap = (paragraph: string): string[] => {
  const chars = Array.from(paragraph);
  const rawTokens: string[] = [];

  for (let i = 0; i < chars.length; ) {
    const ch = chars[i]!;
    if (ASCII_TOKEN.test(ch)) {
      let word = ch;
      i += 1;
      while (i < chars.length && ASCII_TOKEN.test(chars[i]!)) {
        word += chars[i]!;
        i += 1;
      }
      rawTokens.push(word);
    } else if (ch === ' ') {
      let spaces = ch;
      i += 1;
      while (i < chars.length && chars[i] === ' ') {
        spaces += chars[i]!;
        i += 1;
      }
      rawTokens.push(spaces);
    } else {
      rawTokens.push(ch);
      i += 1;
    }
  }

  // Merge opening punctuation onto the following token, then closing punctuation onto the preceding token.
  const mergedOpen: string[] = [];
  let pendingPrefix = '';
  for (const token of rawTokens) {
    if (NO_LINE_END.test(token)) {
      pendingPrefix += token;
    } else {
      mergedOpen.push(pendingPrefix + token);
      pendingPrefix = '';
    }
  }
  if (pendingPrefix) {
    if (mergedOpen.length > 0) {
      mergedOpen[mergedOpen.length - 1] += pendingPrefix;
    } else {
      mergedOpen.push(pendingPrefix);
    }
  }

  const tokens: string[] = [];
  for (const token of mergedOpen) {
    if (NO_LINE_START.test(token) && tokens.length > 0) {
      tokens[tokens.length - 1] += token;
    } else {
      tokens.push(token);
    }
  }
  return tokens;
};

const wrapLongToken = (
  token: string,
  maxWidth: number,
  measureLine: (line: string) => number,
): string[] => {
  const chars = Array.from(token);
  const lines: string[] = [];
  let current = '';

  for (const ch of chars) {
    const candidate = current + ch;
    if (current && measureLine(candidate) > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
};

/**
 * Splits `text` on explicit line breaks and soft-wraps any paragraph exceeding `maxWidth`
 * without mutating the underlying text value.
 */
export const wrapTextLines = (
  text: string,
  maxWidth: number | undefined,
  measureLine: (line: string) => number,
): string[] => {
  if (!text) {
    return [];
  }

  const rawParagraphs = text.split(/\r\n|\r|\n/);
  if (!maxWidth || maxWidth <= 0) {
    return rawParagraphs;
  }

  const wrapped: string[] = [];
  for (const paragraph of rawParagraphs) {
    if (!paragraph || measureLine(paragraph) <= maxWidth) {
      wrapped.push(paragraph);
      continue;
    }

    const tokens = tokenizeForWrap(paragraph);
    let currentLine = '';

    for (const token of tokens) {
      // Skip pure spaces at the start of a newly soft-wrapped line.
      if (!currentLine && /^ +$/.test(token)) {
        continue;
      }

      const candidate = currentLine + token;
      if (currentLine && measureLine(candidate) > maxWidth) {
        wrapped.push(currentLine.replace(/ +$/, ''));
        currentLine = '';
        if (/^ +$/.test(token)) {
          continue;
        }
      }

      if (!currentLine && measureLine(token) > maxWidth) {
        const broken = wrapLongToken(token, maxWidth, measureLine);
        wrapped.push(...broken.slice(0, -1));
        currentLine = broken[broken.length - 1] ?? '';
      } else {
        currentLine += token;
      }
    }

    if (currentLine) {
      wrapped.push(currentLine.replace(/ +$/, ''));
    }
  }

  return wrapped;
};
