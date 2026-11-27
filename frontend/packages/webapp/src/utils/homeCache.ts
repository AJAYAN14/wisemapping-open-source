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
import type { QueryClient } from '@tanstack/react-query';
import type { AccountInfo, Folder, Label, MapInfo } from '../classes/client';
import JwtTokenConfig from '../classes/jwt-token-config';

const HOME_CACHE_PREFIX = 'wm_home_swr_v1:';
const HOME_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type HomeCacheSnapshot = {
  savedAt: number;
  maps?: MapInfo[];
  labels?: Label[];
  folders?: Folder[];
  account?: AccountInfo;
};

const subscribedClients = new WeakSet<QueryClient>();

const getCurrentUserCacheKey = (): string | undefined => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return undefined;
  }
  const token = JwtTokenConfig.retreiveToken();
  if (!token || JwtTokenConfig.isTokenExpired(token)) {
    return undefined;
  }
  const subject = JwtTokenConfig.getSubject(token);
  if (!subject) {
    return undefined;
  }
  return `${HOME_CACHE_PREFIX}${subject}`;
};

const readSnapshot = (key: string): HomeCacheSnapshot | undefined => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as HomeCacheSnapshot;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > HOME_CACHE_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

const writeSnapshotFromQueryClient = (queryClient: QueryClient): void => {
  const key = getCurrentUserCacheKey();
  if (!key) {
    return;
  }
  const maps = queryClient.getQueryData<MapInfo[]>(['maps']);
  const labels = queryClient.getQueryData<Label[]>(['labels']);
  const folders = queryClient.getQueryData<Folder[]>(['folders']);
  const account = queryClient.getQueryData<AccountInfo>(['account']);

  if (!maps && !labels && !folders && !account) {
    return;
  }

  const snapshot: HomeCacheSnapshot = {
    savedAt: Date.now(),
    ...(maps !== undefined ? { maps } : {}),
    ...(labels !== undefined ? { labels } : {}),
    ...(folders !== undefined ? { folders } : {}),
    ...(account !== undefined ? { account } : {}),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota or private-browsing failures.
  }
};

/**
 * Hydrates the latest homepage snapshot into React Query with `updatedAt: 0` so a
 * fresh browser tab renders the maps list immediately and revalidates in the background.
 */
export const hydrateHomeCacheIntoQueryClient = (queryClient: QueryClient): boolean => {
  const key = getCurrentUserCacheKey();
  if (!key) {
    return false;
  }
  const snapshot = readSnapshot(key);
  if (!snapshot) {
    return false;
  }

  let hydratedMaps = false;
  if (Array.isArray(snapshot.maps) && queryClient.getQueryData(['maps']) === undefined) {
    queryClient.setQueryData(['maps'], snapshot.maps, { updatedAt: 0 });
    hydratedMaps = true;
  }
  if (Array.isArray(snapshot.labels) && queryClient.getQueryData(['labels']) === undefined) {
    queryClient.setQueryData(['labels'], snapshot.labels, { updatedAt: 0 });
  }
  if (Array.isArray(snapshot.folders) && queryClient.getQueryData(['folders']) === undefined) {
    queryClient.setQueryData(['folders'], snapshot.folders, { updatedAt: 0 });
  }
  if (snapshot.account && queryClient.getQueryData(['account']) === undefined) {
    queryClient.setQueryData(['account'], snapshot.account, { updatedAt: 0 });
  }
  return hydratedMaps;
};

/** Persists homepage query updates to localStorage for instant future tab opens. */
export const subscribeHomeCachePersistence = (queryClient: QueryClient): void => {
  if (subscribedClients.has(queryClient)) {
    return;
  }
  subscribedClients.add(queryClient);

  let scheduled = false;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action?.type !== 'success') {
      return;
    }
    const rootKey = event.query.queryKey[0];
    if (
      rootKey !== 'maps' &&
      rootKey !== 'labels' &&
      rootKey !== 'folders' &&
      rootKey !== 'account'
    ) {
      return;
    }
    // Only persist top-level homepage queries, not map metadata sub-queries.
    if (event.query.queryKey.length !== 1) {
      return;
    }
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        writeSnapshotFromQueryClient(queryClient);
      });
    }
  });
};

/** Removes all persisted homepage snapshots (e.g. on sign-out or session expiration). */
export const clearHomeCache = (): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(HOME_CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage access failures.
  }
};
