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
import I18nMsg from '@wisemapping/editor/classes/i18n-msg';
import AppI18n from '../classes/app-i18n';
import type Client from '../classes/client';
import { mapMetadataByPathQueryKey } from '../classes/middleware';
import queryClient from '../queryClient';
import { normalizeFolderPath } from './mapPath';

type EditorModule = typeof import('../components/editor-page');
type MapsPageModule = typeof import('../components/maps-page');

let editorModulePromise: Promise<EditorModule> | undefined;
let mapsPageModulePromise: Promise<MapsPageModule> | undefined;
let editorMessagesPromise: Promise<unknown> | undefined;

const EDITOR_FONT_STYLESHEETS = [
  {
    match: 'Material+Icons',
    href: 'https://fonts.googleapis.com/icon?family=Material+Icons&display=swap',
  },
  {
    match: 'Inter',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  },
] as const;

const PREFETCH_STALE_TIME_MS = 30_000;
const HOVER_PREFETCH_DELAY_MS = 100;
const hoverPrefetchTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Preloads editor font stylesheets after list paint so mounting the canvas never triggers late relayout. */
export const preloadEditorFonts = (): void => {
  if (typeof document === 'undefined' || !document.head) {
    return;
  }
  for (const font of EDITOR_FONT_STYLESHEETS) {
    if (document.querySelector(`link[href*="${font.match}"]`)) {
      continue;
    }
    const link = document.createElement('link');
    link.href = font.href;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
};

/** Loads the lazy EditorPage chunk once and reuses the in-flight promise. */
export const loadEditorPage = (): Promise<EditorModule> => {
  if (!editorModulePromise) {
    editorModulePromise = import('../components/editor-page').catch((error) => {
      editorModulePromise = undefined;
      throw error;
    });
  }
  return editorModulePromise;
};

/** Loads the lazy MapsPage chunk once and reuses the in-flight promise. */
export const loadMapsPage = (): Promise<MapsPageModule> => {
  if (!mapsPageModulePromise) {
    mapsPageModulePromise = import('../components/maps-page').catch((error) => {
      mapsPageModulePromise = undefined;
      throw error;
    });
  }
  return mapsPageModulePromise;
};

/** Preloads the EditorPage JS chunk, editor locale messages, and editor font stylesheets. */
export const preloadEditorResources = (): Promise<void> => {
  preloadEditorFonts();
  if (!editorMessagesPromise) {
    editorMessagesPromise = I18nMsg.load(AppI18n.getUserLocale().code).catch(() => {
      editorMessagesPromise = undefined;
    });
  }
  return Promise.all([loadEditorPage().catch(() => undefined), editorMessagesPromise]).then(
    () => undefined,
  );
};

/** Schedules low-priority idle preloading of the editor chunk after list paint. */
export const scheduleIdleEditorPreload = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof win.requestIdleCallback === 'function') {
    const idleId = win.requestIdleCallback(
      () => {
        void preloadEditorResources();
      },
      { timeout: 1500 },
    );
    return () => win.cancelIdleCallback?.(idleId);
  }

  const timerId = window.setTimeout(() => {
    void preloadEditorResources();
  }, 400);
  return () => window.clearTimeout(timerId);
};

/**
 * Schedules low-priority idle preloading of the MapsPage chunk while inside the
 * editor (important when the user entered directly via a map URL and clicks Back).
 */
export const scheduleIdleMapsPreload = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof win.requestIdleCallback === 'function') {
    const idleId = win.requestIdleCallback(
      () => {
        void loadMapsPage().catch(() => undefined);
      },
      { timeout: 1500 },
    );
    return () => win.cancelIdleCallback?.(idleId);
  }

  const timerId = window.setTimeout(() => {
    void loadMapsPage().catch(() => undefined);
  }, 600);
  return () => window.clearTimeout(timerId);
};

const buildHoverKey = (folderPath: string, title: string): string =>
  `${normalizeFolderPath(folderPath)}::${title.trim()}`;

/** Cancels a pending hover-intent prefetch when the pointer leaves before the delay fires. */
export const cancelHoverPrefetchMapForOpen = (folderPath: string, title: string): void => {
  const key = buildHoverKey(folderPath, title);
  const timer = hoverPrefetchTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    hoverPrefetchTimers.delete(key);
  }
};

/**
 * Warms both the editor code chunk and the target map's XML/metadata query cache
 * right before navigation completes (e.g. on pointerDown / Enter).
 */
export const prefetchMapForOpen = (
  client: Client | undefined,
  folderPath: string,
  title: string,
): void => {
  void preloadEditorResources();
  const normalizedTitle = title.trim();
  if (!client || typeof client.fetchMapMetadataByPath !== 'function' || !normalizedTitle) {
    return;
  }
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  cancelHoverPrefetchMapForOpen(normalizedFolderPath, normalizedTitle);

  const queryKey = mapMetadataByPathQueryKey(normalizedFolderPath, normalizedTitle, true);
  const existingState = queryClient.getQueryState(queryKey);
  if (
    existingState?.fetchStatus === 'fetching' ||
    (existingState?.status === 'success' &&
      !existingState.isInvalidated &&
      Date.now() - existingState.dataUpdatedAt < PREFETCH_STALE_TIME_MS)
  ) {
    return;
  }

  void queryClient
    .prefetchQuery({
      queryKey,
      queryFn: () => client.fetchMapMetadataByPath(normalizedFolderPath, normalizedTitle, true),
      staleTime: PREFETCH_STALE_TIME_MS,
    })
    .catch(() => undefined);
};

/**
 * Schedules a map metadata+XML prefetch after a brief hover-intent delay so casual
 * pointer sweeps do not spam the API while real clicks get a multi-hundred-ms head start.
 */
export const scheduleHoverPrefetchMapForOpen = (
  client: Client | undefined,
  folderPath: string,
  title: string,
): void => {
  if (typeof window === 'undefined') {
    return;
  }
  const normalizedTitle = title.trim();
  if (!client || typeof client.fetchMapMetadataByPath !== 'function' || !normalizedTitle) {
    return;
  }
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  const hoverKey = buildHoverKey(normalizedFolderPath, normalizedTitle);
  if (hoverPrefetchTimers.has(hoverKey)) {
    return;
  }
  const timer = setTimeout(() => {
    hoverPrefetchTimers.delete(hoverKey);
    prefetchMapForOpen(client, normalizedFolderPath, normalizedTitle);
  }, HOVER_PREFETCH_DELAY_MS);
  hoverPrefetchTimers.set(hoverKey, timer);
};
