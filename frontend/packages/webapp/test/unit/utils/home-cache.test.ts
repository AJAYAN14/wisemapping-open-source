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
import { QueryClient } from '@tanstack/react-query';
import JwtTokenConfig from '../../../src/classes/jwt-token-config';
import {
  clearHomeCache,
  hydrateHomeCacheIntoQueryClient,
  subscribeHomeCachePersistence,
} from '../../../src/utils/homeCache';

const makeJwt = (payload: Record<string, unknown>): string => {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.sig`;
};

describe('homeCache', () => {
  beforeEach(() => {
    window.localStorage.clear();
    JwtTokenConfig.removeToken();
  });

  afterEach(() => {
    window.localStorage.clear();
    JwtTokenConfig.removeToken();
  });

  it('does not hydrate when signed out or token is expired', () => {
    const qc = new QueryClient();
    expect(hydrateHomeCacheIntoQueryClient(qc)).toBe(false);

    const expiredJwt = makeJwt({
      sub: 'owner@test.com',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    jest.spyOn(JwtTokenConfig, 'retreiveToken').mockReturnValue(expiredJwt);
    expect(hydrateHomeCacheIntoQueryClient(qc)).toBe(false);
  });

  it('persists homepage queries scoped to user and hydrates them stale for background revalidation', async () => {
    const validJwt = makeJwt({
      sub: 'owner@test.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    jest.spyOn(JwtTokenConfig, 'retreiveToken').mockReturnValue(validJwt);

    const writerClient = new QueryClient();
    subscribeHomeCachePersistence(writerClient);
    // Calling twice is idempotent
    subscribeHomeCachePersistence(writerClient);

    writerClient.setQueryData(['maps'], [{ id: 1, title: 'Roadmap' }]);
    writerClient.setQueryData(['labels'], [{ id: 2, title: 'Work', color: '#007AFF' }]);
    writerClient.setQueryData(['folders'], [{ id: 3, name: 'Projects', parentId: null }]);
    writerClient.setQueryData(['account'], { email: 'owner@test.com', firstname: 'Owner' });

    await Promise.resolve();

    const freshTabClient = new QueryClient();
    expect(hydrateHomeCacheIntoQueryClient(freshTabClient)).toBe(true);
    expect(freshTabClient.getQueryData(['maps'])).toEqual([{ id: 1, title: 'Roadmap' }]);
    expect(freshTabClient.getQueryData(['labels'])).toEqual([
      { id: 2, title: 'Work', color: '#007AFF' },
    ]);
    expect(freshTabClient.getQueryData(['folders'])).toEqual([
      { id: 3, name: 'Projects', parentId: null },
    ]);
    expect(freshTabClient.getQueryData(['account'])).toEqual({
      email: 'owner@test.com',
      firstname: 'Owner',
    });
    expect(freshTabClient.getQueryState(['maps'])?.dataUpdatedAt).toBe(0);

    clearHomeCache();
    const afterClearClient = new QueryClient();
    expect(hydrateHomeCacheIntoQueryClient(afterClearClient)).toBe(false);
  });
});
