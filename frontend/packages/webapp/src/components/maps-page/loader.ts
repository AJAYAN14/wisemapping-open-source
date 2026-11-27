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

/**
 * Loads the map list and the labels together with the page's code, so that /c/maps/ renders
 * once, with its maps. Authentication failures (401/403/isAuth) redirect immediately to
 * /c/login so unauthenticated visitors never land on an empty error shell. Other failures
 * remain in the cache for the page to surface.
 */
export const mapsPageLoader = async (): Promise<Response | null> => {
  await AppConfig.initialize();
  const client = AppConfig.getClient();
  await Promise.all([
    import('.'),
    queryClient.prefetchQuery({
      queryKey: ['maps'],
      queryFn: () => client.fetchAllMaps(),
      retry: false,
    }),
    queryClient.prefetchQuery({
      queryKey: ['labels'],
      queryFn: () => client.fetchLabels(),
      retry: false,
    }),
  ]);

  const mapsError = queryClient.getQueryState(['maps'])?.error;
  const labelsError = queryClient.getQueryState(['labels'])?.error;
  if (isAuthErrorInfo(mapsError) || isAuthErrorInfo(labelsError)) {
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
