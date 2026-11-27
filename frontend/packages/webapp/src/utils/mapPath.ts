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

export type ParsedMapRoute =
  | { pageMode: 'edit'; folderPath: string; title: string; hid?: undefined }
  | { pageMode: 'view-private'; folderPath: string; title: string; hid: number };

/** Splits a stored or URL folder path into trimmed non-empty folder segments. */
export function normalizeFolderSegments(folderPath?: string | null): string[] {
  if (!folderPath) {
    return [];
  }
  return folderPath
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/** Normalizes a folder path into the canonical trailing-slash format (`''` for root, `'a/b/'` otherwise). */
export function normalizeFolderPath(folderPath?: string | null): string {
  const segments = normalizeFolderSegments(folderPath);
  return segments.length > 0 ? `${segments.join('/')}/` : '';
}

function encodeMapSegments(folderPath: string | null | undefined, title: string): string {
  const segments = [...normalizeFolderSegments(folderPath), title.trim()];
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

/** Builds `/c/maps/<folderPath...>/<title>/edit` with per-segment URI encoding. */
export function buildMapEditPath(folderPath: string | null | undefined, title: string): string {
  return `/c/maps/${encodeMapSegments(folderPath, title)}/edit`;
}

/** Builds `/c/maps/<folderPath...>/<title>/history/<hid>/view` with per-segment URI encoding. */
export function buildMapHistoryViewPath(
  folderPath: string | null | undefined,
  title: string,
  hid: number,
): string {
  return `/c/maps/${encodeMapSegments(folderPath, title)}/history/${hid}/view`;
}

function decodeMapSegments(rawSegments: string[]): { folderPath: string; title: string } | null {
  if (rawSegments.length === 0) {
    return null;
  }
  const decoded: string[] = [];
  for (const raw of rawSegments) {
    let segment: string;
    try {
      segment = decodeURIComponent(raw).trim();
    } catch {
      return null;
    }
    if (!segment || /[\\/]/.test(segment)) {
      return null;
    }
    decoded.push(segment);
  }
  const title = decoded[decoded.length - 1]!;
  const folderSegments = decoded.slice(0, -1);
  return {
    folderPath: folderSegments.length > 0 ? `${folderSegments.join('/')}/` : '',
    title,
  };
}

/**
 * Parses the React Router splat (`*`) under `/c/maps/` into either edit mode
 * (`<...segments>/edit`) or history view mode (`<...segments>/history/<hid>/view`).
 */
export function parseMapRouteSplat(splat: string | undefined): ParsedMapRoute | null {
  if (!splat) {
    return null;
  }
  const trimmed = splat.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return null;
  }
  const rawSegments = trimmed.split('/');
  if (rawSegments.some((segment) => segment.length === 0)) {
    return null;
  }

  if (rawSegments.length >= 2 && rawSegments[rawSegments.length - 1] === 'edit') {
    const target = decodeMapSegments(rawSegments.slice(0, -1));
    return target ? { pageMode: 'edit', ...target } : null;
  }

  if (
    rawSegments.length >= 4 &&
    rawSegments[rawSegments.length - 3] === 'history' &&
    rawSegments[rawSegments.length - 1] === 'view' &&
    /^\d+$/.test(rawSegments[rawSegments.length - 2]!)
  ) {
    const hid = Number.parseInt(rawSegments[rawSegments.length - 2]!, 10);
    if (!Number.isSafeInteger(hid) || hid < 1) {
      return null;
    }
    const target = decodeMapSegments(rawSegments.slice(0, -3));
    return target ? { pageMode: 'view-private', ...target, hid } : null;
  }

  return null;
}

/** Validates user-entered mindmap titles against empty strings and path-separator slashes. */
export function validateMapTitleInput(title: string): 'blank' | 'slash' | null {
  const trimmed = title.trim();
  if (!trimmed) {
    return 'blank';
  }
  if (/[\\/]/.test(trimmed)) {
    return 'slash';
  }
  return null;
}
