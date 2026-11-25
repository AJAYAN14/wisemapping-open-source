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

const XLINK_NS = 'http://www.w3.org/1999/xlink';

const isExternalHttpUrl = (url: string): boolean =>
  url.startsWith('https://') || url.startsWith('http://');

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image blob as Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });

const fetchAsDataUrl = async (url: string): Promise<string | undefined> => {
  if (typeof fetch !== 'function' || typeof FileReader === 'undefined') {
    return undefined;
  }
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) {
      return undefined;
    }
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return undefined;
  }
};

/**
 * Replaces external HTTP(S) <image> hrefs inside a cloned SVG element with inlined
 * data URLs so SVG-as-<img> rasterization (PNG/JPEG) and html2canvas (PDF) render
 * remote Supabase Storage assets instead of blank or tainted placeholders.
 */
export const inlineExternalImagesInElement = async (root: Element): Promise<void> => {
  const imageElements = Array.from(root.querySelectorAll('image'));
  if (imageElements.length === 0) {
    return;
  }

  const urlsToFetch = new Set<string>();
  const targets: Array<{ el: Element; url: string }> = [];

  for (const el of imageElements) {
    const href = el.getAttribute('href') || el.getAttributeNS(XLINK_NS, 'href') || el.getAttribute('xlink:href');
    if (href && isExternalHttpUrl(href)) {
      urlsToFetch.add(href);
      targets.push({ el, url: href });
    }
  }

  if (targets.length === 0) {
    return;
  }

  const resolvedMap = new Map<string, string>();
  await Promise.all(
    Array.from(urlsToFetch).map(async (url) => {
      const dataUrl = await fetchAsDataUrl(url);
      if (dataUrl) {
        resolvedMap.set(url, dataUrl);
      }
    }),
  );

  for (const { el, url } of targets) {
    const dataUrl = resolvedMap.get(url);
    if (!dataUrl) {
      continue;
    }
    if (el.hasAttribute('href')) {
      el.setAttribute('href', dataUrl);
    }
    if (el.hasAttributeNS(XLINK_NS, 'href') || el.hasAttribute('xlink:href')) {
      el.setAttributeNS(XLINK_NS, 'xlink:href', dataUrl);
    }
    if (!el.hasAttribute('href') && !el.hasAttributeNS(XLINK_NS, 'href')) {
      el.setAttribute('href', dataUrl);
    }
  }
};
