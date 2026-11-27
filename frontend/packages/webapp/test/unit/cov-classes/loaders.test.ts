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

jest.mock('../../../src/utils/editorPreload', () => ({
  loadEditorPage: jest.fn().mockResolvedValue({ default: () => null }),
}));

import type { LoaderFunctionArgs } from 'react-router';
import AppConfig from '../../../src/classes/app-config';
import Client, { MapMetadata } from '../../../src/classes/client';
import JwtTokenConfig from '../../../src/classes/jwt-token-config';
import queryClient from '../../../src/queryClient';
import { loader as rootLoader } from '../../../src/loader';
import { loader as editorLoader } from '../../../src/components/editor-page/loader';
import { appLogger } from '../../../src/utils/logger';
import { getLoadedMessages } from '../../../src/classes/app-i18n/messages';
import I18nMsg from '@wisemapping/editor/classes/i18n-msg';
import { initAppConfig, resetAppConfig } from './helpers/app-config';
import { installWebCrypto } from './helpers/axios-stub';

const metadata = (overrides: Partial<MapMetadata> = {}): MapMetadata => ({
  id: 5,
  title: 'My map',
  folderPath: '',
  creatorFullName: 'Ana',
  isLocked: false,
  jsonProps: '{ "zoom": 1.2 }',
  role: 'editor',
  ...overrides,
});

const fakeClient = (
  fetchMapMetadataByPath: jest.Mock,
  fetchAccountInfo = jest.fn(),
): Client => ({ fetchMapMetadataByPath, fetchAccountInfo }) as unknown as Client;

const runLoader = (splat: string | undefined, bootstrap = false) =>
  editorLoader(bootstrap)({
    params: splat === undefined ? {} : { '*': splat },
  } as unknown as LoaderFunctionArgs);

let removeWebCrypto: () => void;
beforeAll(() => {
  removeWebCrypto = installWebCrypto();
  // Real retries back off for seconds; the retry policy itself is tested on its own.
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retry: false } });
});

afterAll(() => {
  removeWebCrypto();
  resetAppConfig();
  JwtTokenConfig.removeToken();
});

beforeEach(async () => {
  queryClient.clear();
  JwtTokenConfig.removeToken();
  jest.spyOn(appLogger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await initAppConfig();
});

describe('root loader', () => {
  it('initializes the config and loads Chinese messages', async () => {
    const response = await rootLoader();

    await expect(response.json()).resolves.toBe('Load success');
    expect(getLoadedMessages('zh')).toBeDefined();
  });
});

describe('editor page loader', () => {
  const stubClient = (fetchMapMetadataByPath: jest.Mock) =>
    jest.spyOn(AppConfig, 'getClient').mockReturnValue(fakeClient(fetchMapMetadataByPath));

  it.each([undefined, '', 'My map', '12', 'My map/unknown', 'My map/history/abc/view'])(
    'rejects an invalid map route (%s) with a 404',
    async (splat) => {
      stubClient(jest.fn());

      const response = await runLoader(splat);

      expect(response.status).toBe(404);
    },
  );

  it("loads the editor's Chinese messages with the map", async () => {
    stubClient(jest.fn().mockResolvedValue(metadata()));
    await runLoader('My%20map/edit');
    expect(I18nMsg.getLoaded('zh')).toBeDefined();
  });

  it('opens an editable map in root with the role-based mode and the saved zoom', async () => {
    const fetchMapMetadataByPath = jest.fn().mockResolvedValue(metadata());
    stubClient(fetchMapMetadataByPath);

    const response = await runLoader('My%20map/edit');

    await expect(response.json()).resolves.toEqual({
      editorMode: 'edition-editor',
      mapMetadata: metadata(),
      zoom: 1.2,
    });
    expect(fetchMapMetadataByPath).toHaveBeenCalledWith('', 'My map', false);
  });

  it('opens an editable map inside nested folders by folderPath and title', async () => {
    const nestedMeta = metadata({ folderPath: '工作/2026/', title: '项目计划' });
    const fetchMapMetadataByPath = jest.fn().mockResolvedValue(nestedMeta);
    stubClient(fetchMapMetadataByPath);

    const response = await runLoader(
      `${encodeURIComponent('工作')}/2026/${encodeURIComponent('项目计划')}/edit`,
      true,
    );

    await expect(response.json()).resolves.toMatchObject({
      editorMode: 'edition-editor',
      mapMetadata: nestedMeta,
    });
    expect(fetchMapMetadataByPath).toHaveBeenCalledWith('工作/2026/', '项目计划', true);
  });

  it('reuses the cached metadata for the same map path', async () => {
    const fetchMapMetadataByPath = jest.fn().mockResolvedValue(metadata());
    stubClient(fetchMapMetadataByPath);

    await runLoader('My%20map/edit');
    await runLoader('My%20map/edit');

    expect(fetchMapMetadataByPath).toHaveBeenCalledTimes(1);
  });

  it('opens a locked map read-only', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ isLocked: true })));

    const response = await runLoader('My%20map/edit');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'viewonly-private' });
  });

  it('opens a map in edition-owner mode when metadata role is none', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ role: 'none' })));

    const response = await runLoader('My%20map/edit');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'edition-owner' });
  });

  it('opens a locked map read-only even when metadata role is none', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ role: 'none', isLocked: true })));

    const response = await runLoader('My%20map/edit');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'viewonly-private' });
  });

  it('opens a revision through the private history path', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ role: 'none' })));

    const response = await runLoader('My%20map/history/55/view', true);

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'viewonly-private' });
  });

  it('does not bootstrap a history revision with the current map', async () => {
    const fetchMapMetadataByPath = jest.fn().mockResolvedValue(metadata({ xml: '<current/>' }));
    stubClient(fetchMapMetadataByPath);

    const data = await (await runLoader('My%20map/history/55/view', true)).json();

    // The editor then loads revision 55 from its own URL.
    expect(data.bootstrapXML).toBeUndefined();
    expect(fetchMapMetadataByPath).toHaveBeenCalledWith('', 'My map', false);
  });

  it.each([
    ['empty props', ''],
    ['blank props', '   '],
    ['props without zoom', '{"x": 1}'],
    ['a non-numeric zoom', '{"zoom": "big"}'],
    ['invalid JSON', '{zoom'],
    ['a null value', 'null'],
  ])('falls back to the default zoom for %s', async (_name, jsonProps) => {
    stubClient(jest.fn().mockResolvedValue(metadata({ jsonProps })));

    const response = await runLoader('My%20map/edit');

    await expect(response.json()).resolves.toMatchObject({ zoom: 0.8 });
  });

  it('passes the map XML along when bootstrapping', async () => {
    const fetchMapMetadataByPath = jest.fn().mockResolvedValue(metadata({ xml: '<map/>' }));
    stubClient(fetchMapMetadataByPath);

    const response = await runLoader('My%20map/edit', true);

    await expect(response.json()).resolves.toMatchObject({ bootstrapXML: '<map/>' });
    expect(fetchMapMetadataByPath).toHaveBeenCalledWith('', 'My map', true);
  });

  it('bootstraps without XML when the server sends none', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata()));

    const data = await (await runLoader('My%20map/edit', true)).json();

    expect(data.bootstrapXML).toBeUndefined();
  });

  it('redirects to the login, keeping the current url, on an auth error', async () => {
    window.history.pushState({}, '', '/My%20map/edit?zoom=2');
    stubClient(jest.fn().mockRejectedValue({ isAuth: true, status: 403 }));

    const response = await runLoader('My%20map/edit');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      `/login?redirect=${encodeURIComponent('/My%20map/edit?zoom=2')}`,
    );
    window.history.pushState({}, '', '/');
  });

  it('rethrows other errors of the private pages', async () => {
    const error = { msg: 'Not found', status: 404 };
    stubClient(jest.fn().mockRejectedValue(error));

    await expect(runLoader('My%20map/history/55/view')).rejects.toEqual(error);
  });
});
