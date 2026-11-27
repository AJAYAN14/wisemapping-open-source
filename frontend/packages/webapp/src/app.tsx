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
import React, { ReactElement, Suspense, useEffect, useState, useMemo } from 'react';
import { IntlProvider } from 'react-intl';
import {
  Route,
  RouterProvider,
  useParams,
  createRoutesFromElements,
  createBrowserRouter,
  useSearchParams,
  useLocation,
  Outlet,
} from 'react-router';
import LoginPage from './components/login-page';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppTheme } from './theme';
import AppI18n, { Locales } from './classes/app-i18n';
import { useLocaleMessages } from './classes/app-i18n/messages';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as MuiThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { ThemeProvider } from '@emotion/react';
import { AppThemeProvider, useTheme } from './contexts/ThemeContext';
import OAuthCallbackPage from './components/oauth-callback';
import ErrorPage from './components/error-page';
import LoadingFallback from './components/loading-fallback';
import { MapsPageLoading } from './components/maps-page/maps-list/MapsListSkeleton';
import { mapsPageLoader } from './components/maps-page/loader';
import MapsPageErrorFallback from './components/maps-page/MapsPageErrorFallback';
import EditorLoadingSkeleton from '@wisemapping/editor/components/editor-loading-skeleton';
import { loader as mapLoader } from './components/editor-page/loader';
import { loader as configLoader } from './loader';
import queryClient from './queryClient';

import { ClientContext } from './classes/provider/client-context';
import { KeyboardContext, useKeyboardContextValue } from './classes/provider/keyboard-context';
import CommonPage from './components/common-page';
import Redirect from './components/redirect';
import AppConfig from './classes/app-config';
import { useFetchAccount } from './classes/middleware';
import { parseMapRouteSplat } from './utils/mapPath';
import { registerRouterNavigate } from './utils/appNavigation';
import { loadEditorPage, loadMapsPage } from './utils/editorPreload';
import {
  hydrateHomeCacheIntoQueryClient,
  subscribeHomeCachePersistence,
} from './utils/homeCache';

const EditorPage = React.lazy(loadEditorPage);
const MapsPage = React.lazy(loadMapsPage);

const LegacyMapWildcardRedirect = (): ReactElement => {
  const splat = useParams()['*'];
  return <Redirect to={splat ? `/${splat}` : '/'} />;
};

const PageEditorWrapper = () => {
  const splat = useParams()['*'];
  const [searchParams] = useSearchParams();
  const parsed = parseMapRouteSplat(splat);
  if (!parsed) {
    return (
      <IntlProviderWrapper>
        <ErrorPage />
      </IntlProviderWrapper>
    );
  }

  // Fetch zoom id from query param ...
  const zoomStr = searchParams.get('zoom');
  const zoom = zoomStr ? Number.parseFloat(zoomStr) : undefined;

  return (
    <Suspense fallback={<EditorLoadingSkeleton />}>
      <EditorPage pageMode={parsed.pageMode} hid={parsed.hid} zoom={zoom} />
    </Suspense>
  );
};

// Wrapper component that provides Chinese locale to IntlProvider
const IntlProviderWrapper = ({ children }: { children: React.ReactNode }): ReactElement => {
  const location = useLocation();
  const account = useFetchAccount();
  const locale = AppI18n.getUserLocale(account?.locale);
  const intlLocale = useLocaleMessages(locale.code);

  return (
    <IntlProvider
      locale={intlLocale.locale}
      defaultLocale={Locales.ZH.code}
      messages={intlLocale.messages}
      key={location.pathname} // Force re-render when pathname changes
    >
      {children}
    </IntlProvider>
  );
};

const buildRouter = () =>
  createBrowserRouter(
    createRoutesFromElements(
      <Route
        element={
          <IntlProviderWrapper>
            <Outlet />
          </IntlProviderWrapper>
        }
      >
        <Route
          loader={configLoader}
          errorElement={
            <IntlProviderWrapper>
              <ErrorPage />
            </IntlProviderWrapper>
          }
          hydrateFallbackElement={<LoadingFallback />}
        >
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
          <Route path="/registration-google" element={<OAuthCallbackPage />} />

          {/* Legacy /c/* redirects & aliases for backward compatibility */}
          <Route path="/c/login" element={<Redirect to="/login" />} />
          <Route path="/c/oauth-callback" element={<OAuthCallbackPage />} />
          <Route path="/c/registration-google" element={<OAuthCallbackPage />} />
          <Route path="/c/maps" element={<Redirect to="/" />} />
          <Route path="/c/maps/" element={<Redirect to="/" />} />
          <Route path="/c/maps/*" element={<LegacyMapWildcardRedirect />} />

          <Route element={<CommonPage />}>
            <Route
              path="/"
              loader={mapsPageLoader}
              hydrateFallbackElement={<MapsPageLoading />}
              element={
                <Suspense fallback={<MapsPageLoading />}>
                  <MapsPage />
                </Suspense>
              }
              errorElement={<MapsPageErrorFallback />}
            />
            <Route
              path="/*"
              element={<PageEditorWrapper />}
              loader={mapLoader(true)}
              errorElement={
                <IntlProviderWrapper>
                  <ErrorPage />
                </IntlProviderWrapper>
              }
            />
          </Route>
          {/* Catch-all route for unmatched paths (404) */}
          <Route
            path="*"
            element={
              <IntlProviderWrapper>
                <ErrorPage />
              </IntlProviderWrapper>
            }
          />
        </Route>
      </Route>,
    ),
  );

const AppWithTheme = (): ReactElement => {
  const keyboardContext = useKeyboardContextValue();
  const { mode } = useTheme();
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  // index.html paints the page in the theme's background before the app loads (theme-preload);
  // it follows the mode when the user switches it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = mode;
    root.style.backgroundColor = theme.palette.background.default;
  }, [mode, theme]);
  const [router, setRouter] = useState<ReturnType<typeof createBrowserRouter> | undefined>(() => {
    const syncConfig =
      typeof AppConfig.tryInitializeSync === 'function' ? AppConfig.tryInitializeSync() : undefined;
    if (!syncConfig) {
      return undefined;
    }
    hydrateHomeCacheIntoQueryClient(queryClient);
    subscribeHomeCachePersistence(queryClient);
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname === '/' || window.location.pathname.startsWith('/c/maps'))
    ) {
      void loadMapsPage().catch(() => undefined);
    }
    return buildRouter();
  });
  const [initializationError, setInitializationError] = useState<string>();

  useEffect(() => {
    if (!router) {
      return undefined;
    }
    registerRouterNavigate((to) => router.navigate?.(to));
    return () => registerRouterNavigate(undefined);
  }, [router]);

  useEffect(() => {
    if (router) {
      return undefined;
    }
    let cancelled = false;

    AppConfig.initialize()
      .then(() => {
        if (!cancelled) {
          setRouter(buildRouter());
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error && typeof error === 'object' && 'msg' in error) {
            setInitializationError((error as { msg: string }).msg);
          } else if (error instanceof Error) {
            setInitializationError(error.message);
          } else {
            setInitializationError('Unable to load application configuration.');
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // The theme wraps the whole app, the moments before the router is ready included: an empty
  // page rendered outside it showed the browser's white between the steps of signing in, also in
  // dark mode.
  return (
    <StyledEngineProvider injectFirst>
      <MuiThemeProvider theme={theme}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {initializationError ? (
            <div role="alert">{initializationError}</div>
          ) : (
            router && (
              <ClientContext value={AppConfig.getClient()}>
                <QueryClientProvider client={queryClient}>
                  <KeyboardContext value={keyboardContext}>
                    <RouterProvider router={router} />
                  </KeyboardContext>
                </QueryClientProvider>
              </ClientContext>
            )
          )}
        </ThemeProvider>
      </MuiThemeProvider>
    </StyledEngineProvider>
  );
};

const App = (): ReactElement => {
  return (
    <AppThemeProvider>
      <AppWithTheme />
    </AppThemeProvider>
  );
};

export default App;
