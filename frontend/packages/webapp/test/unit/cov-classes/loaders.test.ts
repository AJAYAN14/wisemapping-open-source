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

import type { LoaderFunctionArgs } from 'react-router';
import AppConfig from '../../../src/classes/app-config';
import Client, { MapMetadata } from '../../../src/classes/client';
import JwtTokenConfig from '../../../src/classes/jwt-token-config';
import queryClient from '../../../src/queryClient';
import { loader as rootLoader } from '../../../src/loader';
import { loader as editorLoader, PageModeType } from '../../../src/components/editor-page/loader';
import { appLogger } from '../../../src/utils/logger';
import { getLoadedMessages } from '../../../src/classes/app-i18n/messages';
import I18nMsg from '@wisemapping/editor/classes/i18n-msg';
import { initAppConfig, resetAppConfig } from './helpers/app-config';
import { installWebCrypto } from './helpers/axios-stub';

const metadata = (overrides: Partial<MapMetadata> = {}): MapMetadata => ({
  id: 5,
  title: 'My map',
  creatorFullName: 'Ana',
  isLocked: false,
  jsonProps: '{ "zoom": 1.2 }',
  role: 'editor',
  ...overrides,
});

const fakeClient = (fetchMapMetadata: jest.Mock, fetchAccountInfo = jest.fn()): Client =>
  ({ fetchMapMetadata, fetchAccountInfo }) as unknown as Client;

const runLoader = (
  pageMode: PageModeType,
  id: string | undefined,
  bootstrap = false,
  hid?: string,
) =>
  editorLoader(
    pageMode,
    bootstrap,
  )({
    params: id === undefined ? {} : hid === undefined ? { id } : { id, hid },
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
  const stubClient = (fetchMapMetadata: jest.Mock) =>
    jest.spyOn(AppConfig, 'getClient').mockReturnValue(fakeClient(fetchMapMetadata));

  it.each([undefined, 'undefined'])('rejects a missing map id (%s) with a 400', async (id) => {
    stubClient(jest.fn());

    const response = await runLoader('edit', id);

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Map ID is required');
  });

  it("loads the editor's Chinese messages with the map", async () => {
    stubClient(jest.fn().mockResolvedValue(metadata()));
    await runLoader('edit', '3');
    expect(I18nMsg.getLoaded('zh')).toBeDefined();
  });

  it('rejects a non-numeric map id with a 400', async () => {
    stubClient(jest.fn());

    const response = await runLoader('edit', 'abc');

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Invalid map ID');
  });

  it('opens an editable map with the role-based mode and the saved zoom', async () => {
    const fetchMapMetadata = jest.fn().mockResolvedValue(metadata());
    stubClient(fetchMapMetadata);

    const response = await runLoader('edit', '5');

    await expect(response.json()).resolves.toEqual({
      editorMode: 'edition-editor',
      mapMetadata: metadata(),
      zoom: 1.2,
    });
    expect(fetchMapMetadata).toHaveBeenCalledWith(5, false);
  });

  it('reuses the cached metadata for the same map', async () => {
    const fetchMapMetadata = jest.fn().mockResolvedValue(metadata());
    stubClient(fetchMapMetadata);

    await runLoader('edit', '5');
    await runLoader('edit', '5');

    expect(fetchMapMetadata).toHaveBeenCalledTimes(1);
  });

  it('opens a locked map read-only', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ isLocked: true })));

    const response = await runLoader('edit', '5');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'viewonly-private' });
  });

  it('opens a map in edition-owner mode when metadata role is none', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ role: 'none' })));

    const response = await runLoader('edit', '5');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'edition-owner' });
  });

  it('opens a locked map read-only even when metadata role is none', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ role: 'none', isLocked: true })));

    const response = await runLoader('edit', '5');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'viewonly-private' });
  });

  it("opens a revision through the private history endpoint", async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ role: 'none' })));

    const response = await runLoader('view-private', '5', true, '55');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'viewonly-private' });
  });

  it('does not bootstrap a history revision with the current map', async () => {
    const fetchMapMetadata = jest.fn().mockResolvedValue(metadata({ xml: '<current/>' }));
    stubClient(fetchMapMetadata);

    const data = await (await runLoader('view-private', '5', true, '55')).json();

    // The editor then loads revision 55 from its own URL.
    expect(data.bootstrapXML).toBeUndefined();
    expect(fetchMapMetadata).toHaveBeenCalledWith(5, false);
  });

  it('opens the private view read-only', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata({ role: 'owner' })));

    const response = await runLoader('view-private', '5');

    await expect(response.json()).resolves.toMatchObject({ editorMode: 'viewonly-private' });
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

    const response = await runLoader('edit', '5');

    await expect(response.json()).resolves.toMatchObject({ zoom: 0.8 });
  });

  it('passes the map XML along when bootstrapping', async () => {
    const fetchMapMetadata = jest.fn().mockResolvedValue(metadata({ xml: '<map/>' }));
    stubClient(fetchMapMetadata);

    const response = await runLoader('edit', '5', true);

    await expect(response.json()).resolves.toMatchObject({ bootstrapXML: '<map/>' });
    expect(fetchMapMetadata).toHaveBeenCalledWith(5, true);
  });

  it('bootstraps without XML when the server sends none', async () => {
    stubClient(jest.fn().mockResolvedValue(metadata()));

    const data = await (await runLoader('edit', '5', true)).json();

    expect(data.bootstrapXML).toBeUndefined();
  });

  it('redirects to the login, keeping the current url, on an auth error', async () => {
    window.history.pushState({}, '', '/c/maps/5/edit?zoom=2');
    stubClient(jest.fn().mockRejectedValue({ isAuth: true, status: 403 }));

    const response = await runLoader('edit', '5');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      `/c/login?redirect=${encodeURIComponent('/c/maps/5/edit?zoom=2')}`,
    );
    window.history.pushState({}, '', '/');
  });

  it('rethrows other errors of the private pages', async () => {
    const error = { msg: 'Not found', status: 404 };
    stubClient(jest.fn().mockRejectedValue(error));

    await expect(runLoader('view-private', '5')).rejects.toEqual(error);
  });

  it('fails on an unknown page mode', async () => {
    stubClient(jest.fn());

    await expect(runLoader('other' as PageModeType, '5')).rejects.toThrow('other');
  });
});
