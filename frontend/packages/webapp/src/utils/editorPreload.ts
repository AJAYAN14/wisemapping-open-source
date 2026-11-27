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

type EditorModule = typeof import('../components/editor-page');
type MapsPageModule = typeof import('../components/maps-page');

let editorModulePromise: Promise<EditorModule> | undefined;
let mapsPageModulePromise: Promise<MapsPageModule> | undefined;
let editorMessagesPromise: Promise<unknown> | undefined;

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

/** Preloads both the EditorPage JS chunk and editor locale messages. */
export const preloadEditorResources = (): Promise<void> => {
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
  if (!client || typeof client.fetchMapMetadataByPath !== 'function' || !title) {
    return;
  }
  const normalizedFolderPath = folderPath ?? '';
  void queryClient
    .prefetchQuery({
      queryKey: mapMetadataByPathQueryKey(normalizedFolderPath, title, true),
      queryFn: () => client.fetchMapMetadataByPath(normalizedFolderPath, title, true),
      staleTime: 30_000,
    })
    .catch(() => undefined);
};
