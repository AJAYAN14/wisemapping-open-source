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

import { fireEvent, screen, within } from '@testing-library/react';

jest.mock('react-router', () => jest.requireActual('../router-mock'));

import AccountMenu from '../../../../src/components/maps-page/account-menu';
import Client, { AccountInfo, AuthenticationType } from '../../../../src/classes/client';
import { Locales } from '../../../../src/classes/app-i18n';
import { renderWithProviders } from '../../helpers/render';
import { resetRouter, setLocation } from '../router-mock';

const account = (extra: Partial<AccountInfo> = {}): AccountInfo => ({
  firstname: 'Jane',
  lastname: 'Doe',
  email: 'jane@wisemapping.com',
  locale: Locales.ZH,
  authenticationType: AuthenticationType.GOOGLE_OAUTH2,
  isAdmin: false,
  ...extra,
});

beforeEach(() => {
  resetRouter();
  setLocation('/');
  localStorage.clear();
});

describe('AccountMenu', () => {
  const setup = (info: AccountInfo = account(), withStorageStats = false) => {
    const client = {
      fetchAccountInfo: jest.fn(() => Promise.resolve(info)),
      logout: jest.fn(() => Promise.resolve()),
      ...(withStorageStats ? { fetchAssetStorageStats: jest.fn() } : {}),
    };
    renderWithProviders(<AccountMenu />, { client: client as unknown as Client });
    return client;
  };

  const openMenu = async (): Promise<HTMLElement> => {
    fireEvent.click(await screen.findByRole('button', { name: 'Jane Doe' }));
    return screen.findByRole('menu');
  };

  test('names the signed-in user on the avatar button', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Jane Doe' })).toBeTruthy();
  });

  test('shows storage menu item only when storage stats client method is available', async () => {
    setup(account(), false);
    let menu = await openMenu();
    expect(within(menu).queryByRole('menuitem', { name: '存储空间管理' })).toBeNull();

    setup(account(), true);
    const triggers = await screen.findAllByRole('button', { name: 'Jane Doe' });
    fireEvent.click(triggers[triggers.length - 1]!);
    const menus = await screen.findAllByRole('menu');
    menu = menus[menus.length - 1]!;
    expect(within(menu).getByRole('menuitem', { name: '存储空间管理' })).toBeTruthy();
  });

  test('Sign Out calls logout', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = setup();
    const menu = await openMenu();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign Out' }));

    expect(client.logout).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  test('sidebar variant renders theme and storage quick buttons in a 2-column row above account card', async () => {
    const fetchAssetStorageStats = jest.fn().mockResolvedValue({
      usedBytes: 0,
      quotaBytes: 1024,
      assetCount: 0,
    });
    const client = {
      fetchAccountInfo: jest.fn(() => Promise.resolve(account())),
      logout: jest.fn(() => Promise.resolve()),
      fetchAssetStorageStats,
    };
    renderWithProviders(<AccountMenu variant="sidebar" drawerOpen={true} />, {
      client: client as unknown as Client,
    });

    const themeBtn = await screen.findByRole('button', { name: '切换到深色模式' });
    const storageBtn = screen.getByRole('button', { name: '存储空间管理' });
    expect(themeBtn).toBeTruthy();
    expect(storageBtn).toBeTruthy();

    fireEvent.click(storageBtn);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
