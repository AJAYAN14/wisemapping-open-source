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

import { screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';

jest.mock('react-router', () => jest.requireActual('../router-mock'));
jest.mock('@wisemapping/editor/components/editor-loading-skeleton', () => ({
  __esModule: true,
  default: () => <div>editor skeleton</div>,
}));

import Header from '../../../../src/components/layout/header';
import LoadingFallback from '../../../../src/components/loading-fallback';
import { createAppTheme } from '../../../../src/theme';
import { renderWithProviders } from '../../helpers/render';
import { renderPage, installMatchMedia } from '../helpers';
import { setLocation } from '../router-mock';

beforeEach(() => {
  installMatchMedia();
});

const hrefs = (name: string): (string | null)[] =>
  screen.queryAllByRole('link', { name }).map((link) => link.getAttribute('href'));

describe('Header', () => {
  test('shows only the logo linking to login', () => {
    renderWithProviders(<Header />);
    expect(hrefs('WiseMapping logo')).toEqual(['/login']);
    expect(hrefs('Sign In')).toEqual([]);
    expect(hrefs('Sign Up')).toEqual([]);
  });

  test('renders the logo, linking to login, on the dark theme too', () => {
    // Asset imports are stubbed, so which of the two logos is used can not be told apart here.
    renderWithProviders(
      <ThemeProvider theme={createAppTheme('dark')}>
        <Header />
      </ThemeProvider>,
    );
    expect(hrefs('WiseMapping logo')).toEqual(['/login']);
  });
});

describe('LoadingFallback', () => {
  test('outside the editor and the map list shows a spinner', () => {
    setLocation('/c/admin');
    renderWithProviders(<LoadingFallback />);
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  test.each(['/c/login', '/es/c/login', '/c/oauth-callback', '/c/registration-google'])(
    'on the sign-in route %s shows the waiting screen of signing in',
    (path) => {
      // The OAuth callback and the login page show the same screen while they work; loading them
      // in it keeps signing in from reading as a run of different pages.
      setLocation(path);
      renderPage(<LoadingFallback />);
      const status = screen.getByRole('status');
      expect(status.querySelector('[role="progressbar"]')).not.toBeNull();
      // The same message as the callback and the login page: one text through signing in.
      expect(status.textContent).toBe('Please wait while we validate your identity');
      expect(status.closest('section')).not.toBeNull();
      expect(screen.queryByText('Loading...')).toBeNull();
    },
  );

  test.each(['/', '/c/maps', '/c/maps/'])('on the map list %s shows its skeleton', (path) => {
    // The same skeleton the map list keeps up while it loads: one skeleton, then the page.
    setLocation(path);
    renderWithProviders(<LoadingFallback />);
    expect(screen.queryByText('Loading...')).toBeNull();
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  test.each([
    '/My%20map/edit',
    '/Work/My%20map/edit',
    '/My%20map/history/7/view',
    '/c/maps/My%20map/edit',
    '/c/maps/Work/My%20map/edit',
    '/c/maps/My%20map/history/7/view',
  ])('on the editor route %s shows the editor skeleton', (path) => {
      setLocation(path);
      renderWithProviders(<LoadingFallback />);
      expect(screen.getByText('editor skeleton')).toBeTruthy();
      expect(screen.queryByText('Loading...')).toBeNull();
    },
  );
});
