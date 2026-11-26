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

/**
 * The application route table: which page each path renders, behind which
 * layout, with which loader and error element. react-router itself is replaced
 * by `mock-router.tsx` (it is ESM-only), and every page by a named stub.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('react-router', () => jest.requireActual('./mock-router'));

const mockStub = (name: string) => ({
  __esModule: true,
  default: () => {
    const ReactActual = jest.requireActual<typeof React>('react');
    return ReactActual.createElement('div', null, name);
  },
});

jest.mock('../../../src/components/login-page', () => mockStub('login-page'));
jest.mock('../../../src/components/oauth-callback', () => mockStub('oauth-callback-page'));
jest.mock('../../../src/components/error-page', () => mockStub('error-page'));
jest.mock('../../../src/components/loading-fallback', () => mockStub('loading-fallback'));
jest.mock('../../../src/components/maps-page/maps-list/MapsListSkeleton', () => ({
  MapsPageLoading: () => 'maps-page-loading',
}));
jest.mock('../../../src/components/maps-page/MapsPageErrorFallback', () =>
  mockStub('maps-page-error-fallback'),
);
jest.mock('@wisemapping/editor/components/editor-loading-skeleton', () => ({
  __esModule: true,
  default: () => 'editor-loading',
}));
jest.mock('../../../src/components/editor-page/loader', () => ({
  loader: (mode: string, bootstrap: boolean) => `map-loader:${mode}:${bootstrap}`,
}));
jest.mock('../../../src/loader', () => ({ loader: 'config-loader' }));
jest.mock('../../../src/components/maps-page/loader', () => ({ mapsPageLoader: 'maps-loader' }));
jest.mock('../../../src/components/common-page', () => {
  const { Outlet } = jest.requireActual('./mock-router');
  const ReactActual = jest.requireActual<typeof React>('react');
  return {
    __esModule: true,
    default: () =>
      ReactActual.createElement(
        'div',
        { 'data-testid': 'common-page' },
        ReactActual.createElement(Outlet),
      ),
  };
});
jest.mock('../../../src/components/redirect', () => ({
  __esModule: true,
  default: ({ to }: { to: string }) => `redirect:${to}`,
}));
jest.mock('../../../src/components/editor-page', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => `editor-page:${JSON.stringify(props)}`,
}));
jest.mock('../../../src/components/maps-page', () => mockStub('maps-page'));
jest.mock('../../../src/contexts/ThemeContext', () => ({
  AppThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ mode: 'light' }),
}));

import App from '../../../src/app';
import AppConfig from '../../../src/classes/app-config';
import Client from '../../../src/classes/client';
import { lastMatch, RouteObject } from './mock-router';
import { defined } from '../defined';

const client = {
  fetchAccountInfo: jest.fn().mockResolvedValue({ email: 'ada@example.com' }),
  onSessionExpired: jest.fn(),
};

const renderAt = (url: string) => {
  window.history.pushState({}, '', url);
  jest.spyOn(AppConfig, 'getClient').mockReturnValue(client as unknown as Client);
  jest.spyOn(AppConfig, 'initialize').mockResolvedValue({} as never);
  return render(<App />);
};

/** The route that matched the path (the leaf of the chain). */
const leaf = (): RouteObject => {
  const chain = lastMatch.current?.chain ?? [];
  return defined(chain.at(-1));
};

const errorElementName = (route: RouteObject): string | undefined => {
  const el = route.errorElement as React.ReactElement<{ children?: React.ReactElement }>;
  if (!el) return undefined;
  // Most error elements are the generic page wrapped in the intl provider.
  const inner = el.props.children ?? el;
  return render(inner).container.textContent ?? undefined;
};

describe('App', () => {
  test('renders nothing until the configuration is loaded', () => {
    jest.spyOn(AppConfig, 'initialize').mockReturnValue(new Promise(() => undefined));
    const { container } = render(<App />);
    expect(container.textContent).toBe('');
  });

  test.each<[string, unknown, string]>([
    ['an error with a msg', { msg: 'Backend unavailable' }, 'Backend unavailable'],
    ['an Error', new Error('Config fetch failed'), 'Config fetch failed'],
    ['anything else', 'nope', 'Unable to load application configuration.'],
  ])('reports a configuration failure given %s', async (_name, error, message) => {
    jest.spyOn(AppConfig, 'initialize').mockRejectedValue(error);
    render(<App />);

    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  test('ignores a configuration result that arrives after unmounting', async () => {
    let resolve: () => void = () => undefined;
    const buildSpy = jest.spyOn(AppConfig, 'getClient');
    jest.spyOn(AppConfig, 'initialize').mockReturnValue(
      new Promise((r) => {
        resolve = () => r({} as never);
      }),
    );
    const { unmount } = render(<App />);
    unmount();
    resolve();
    await Promise.resolve();

    expect(buildSpy).not.toHaveBeenCalled();
  });

  test('"/" redirects to the login page', async () => {
    renderAt('/');

    expect(await screen.findByText('redirect:/c/login')).toBeTruthy();
    // Every page sits below the configuration loader.
    expect(defined(lastMatch.current?.chain[1]).loader).toBe('config-loader');
    expect(errorElementName(defined(lastMatch.current?.chain[1]))).toBe('error-page');
  });

  test.each([
    ['/c/login', 'login-page'],
    ['/c/registration-google', 'oauth-callback-page'],
    ['/c/oauth-callback', 'oauth-callback-page'],
    ['/c/no-such-page', 'error-page'],
  ])('%s renders the %s', async (url, page) => {
    renderAt(url);
    expect(await screen.findByText(page)).toBeTruthy();
  });

  test('the maps list is a lazy page inside the common page, with its own error fallback', async () => {
    renderAt('/c/maps/');

    expect(await screen.findByText('maps-page')).toBeTruthy();
    expect(screen.getByTestId('common-page')).toBeTruthy();
    expect(errorElementName(leaf())).toBe('maps-page-error-fallback');
    // The maps are loaded with the page's code, so the page renders once, with them.
    expect(leaf().loader).toBe('maps-loader');
  });

  test.each([
    ['/c/maps/12/edit', 'edit', { pageMode: 'edit', mapId: 12 }],
    ['/c/maps/12/edit?zoom=1.5', 'edit', { pageMode: 'edit', mapId: 12, zoom: 1.5 }],
    ['/c/maps/12/7/view', 'view-private', { pageMode: 'view-private', mapId: 12, hid: 7 }],
  ])('%s opens the editor in %s mode', async (url, mode, props) => {
    renderAt(url);

    const editor = await screen.findByText(/^editor-page:/);
    expect(JSON.parse(editor.textContent!.slice('editor-page:'.length))).toEqual(props);
    expect(leaf().loader).toBe(`map-loader:${mode}:true`);
    expect(errorElementName(leaf())).toBe('error-page');
  });
});
