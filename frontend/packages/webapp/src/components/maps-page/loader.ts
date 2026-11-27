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

import AppConfig from '../../classes/app-config';
import queryClient from '../../queryClient';
import { buildLoginRedirectUrl, isAuthErrorInfo, leaveTo } from '../../utils/redirect';
import { loadMapsPage } from '../../utils/editorPreload';
import {
  clearHomeCache,
  hydrateHomeCacheIntoQueryClient,
  subscribeHomeCachePersistence,
} from '../../utils/homeCache';

/**
 * Loads the map list, labels, folders and account together with the page's code.
 * When returning from the editor or opening a fresh tab with a valid local SWR snapshot,
 * the cached list renders immediately while fresh data revalidates in the background.
 * Cold uncached visits still await maps/labels so auth failures redirect immediately to /login.
 */
export const mapsPageLoader = async (): Promise<Response | null> => {
  await AppConfig.initialize();
  const client = AppConfig.getClient();

  hydrateHomeCacheIntoQueryClient(queryClient);
  subscribeHomeCachePersistence(queryClient);

  const hasCachedMaps = queryClient.getQueryData(['maps']) !== undefined;
  const pageChunkPromise = loadMapsPage().catch(() => undefined);

  const mapsPromise = queryClient.prefetchQuery({
    queryKey: ['maps'],
    queryFn: () => client.fetchAllMaps(),
    retry: false,
  });
  const labelsPromise = queryClient.prefetchQuery({
    queryKey: ['labels'],
    queryFn: () => client.fetchLabels(),
    retry: false,
  });

  if (typeof client.fetchFolders === 'function') {
    void queryClient
      .prefetchQuery({
        queryKey: ['folders'],
        queryFn: () => client.fetchFolders!(),
        retry: false,
      })
      .catch(() => undefined);
  }
  if (typeof client.fetchAccountInfo === 'function') {
    void queryClient
      .prefetchQuery({
        queryKey: ['account'],
        queryFn: () => client.fetchAccountInfo(),
        retry: false,
      })
      .catch(() => undefined);
  }

  if (hasCachedMaps) {
    // Do not block rendering or back-to-home transitions when cached maps are already available.
    void Promise.all([mapsPromise, labelsPromise]).catch(() => undefined);
    await pageChunkPromise;
    return null;
  }

  await Promise.all([pageChunkPromise, mapsPromise, labelsPromise]);

  const mapsError = queryClient.getQueryState(['maps'])?.error;
  const labelsError = queryClient.getQueryState(['labels'])?.error;
  if (isAuthErrorInfo(mapsError) || isAuthErrorInfo(labelsError)) {
    clearHomeCache();
    const loginUrl = buildLoginRedirectUrl();
    if (typeof Response !== 'undefined') {
      return new Response('Sign in required, redirect to login.', {
        status: 302,
        headers: {
          Location: loginUrl,
        },
      });
    }
    leaveTo(loginUrl);
  }

  return null;
};
