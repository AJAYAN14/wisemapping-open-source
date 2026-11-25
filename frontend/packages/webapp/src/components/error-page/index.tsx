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
import React, { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import Header from '../layout/header';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import {
  ErrorCanvas,
  ErrorBody,
  ErrorContent,
  ErrorBadge,
  ApplePrimaryButton,
  AppleSecondaryButton,
} from './styled';
import { isRouteErrorResponse, useRouteError, useNavigate, useLocation } from 'react-router';
import { Link as RouterLink } from 'react-router';
import { ErrorInfo } from '../../classes/client';
import { logCriticalError } from '../../utils';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import ExploreOffRoundedIcon from '@mui/icons-material/ExploreOffRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

export type ErrorPageType = {
  isSecurity: boolean;
};

const isErrorInfo = (error: unknown): error is ErrorInfo =>
  typeof error === 'object' &&
  error !== null &&
  ('msg' in error || 'isAuth' in error || 'fields' in error);

const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  typeof error.message === 'string';

const safeSerialize = (error: unknown): string => {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const ErrorPage = (): React.ReactElement => {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const error = useRouteError();
  const routeError = isRouteErrorResponse(error) ? error : undefined;
  const errorInfo = isErrorInfo(error) ? error : undefined;

  // If no error is thrown (catch-all route), treat as 404. useRouteError returns unknown: undefined
  // when nothing was thrown, null for a `throw null`.
  const nothingThrown = error === undefined || error === null;
  const isNotFound = nothingThrown || routeError?.status === 404;
  const isAccessError =
    (routeError && (routeError.status === 401 || routeError.status === 403)) ||
    Boolean(errorInfo?.isAuth);

  if (isNotFound && nothingThrown) {
    logCriticalError('Page not found error (catch-all route).', '404');
  } else if (routeError?.status === 404) {
    logCriticalError('Page not found error.', '404');
  } else if (error !== undefined && !isAccessError) {
    logCriticalError('Handling ErrorPage redirect error', safeSerialize(error));
  }

  const headline = (() => {
    if (isNotFound) {
      return (
        <FormattedMessage id="error.not-found-title" defaultMessage="We can't find that page." />
      );
    }
    if (routeError?.status === 410) {
      return (
        <FormattedMessage
          id="error.map-unavailable-title"
          defaultMessage="This mindmap is not available for public display."
        />
      );
    }
    if (isAccessError) {
      return (
        <FormattedMessage
          id="error.permission-denied-title"
          defaultMessage="You don't have access to this page."
        />
      );
    }
    return <FormattedMessage id="error.generic-title" defaultMessage="Hmm, that didn't work." />;
  })();

  const fallbackDetail = (() => {
    if (isNotFound) {
      return (
        <FormattedMessage
          id="error.not-found-message"
          defaultMessage="The page you're looking for might have been removed, had its name changed, or is temporarily unavailable."
        />
      );
    }
    if (routeError?.status === 410) {
      return '该思维导图当前不可公开查看。';
    }
    if (isAccessError) {
      return '请先使用 Google 账号登录后再试。';
    }
    return '请返回首页或刷新页面重试。';
  })();

  const detailMessage =
    (errorInfo?.msg && errorInfo.msg.trim().length > 0 && errorInfo.msg) ||
    (routeError &&
      !isNotFound &&
      routeError.status !== 410 &&
      typeof routeError.statusText === 'string' &&
      routeError.statusText.trim().length > 0 &&
      routeError.statusText) ||
    (routeError &&
      !isNotFound &&
      routeError.status !== 410 &&
      typeof routeError.data === 'string' &&
      routeError.data.trim().length > 0 &&
      routeError.data) ||
    (hasMessage(error) && error.message.trim().length > 0 && error.message) ||
    fallbackDetail;

  const handleGoHome = () => {
    navigate('/c/maps/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    document.title = intl.formatMessage({
      id: 'error.page-title',
      defaultMessage: 'Unexpected Error | WiseMapping',
    });

    const unhandledErrorHandler = (event: ErrorEvent): void => {
      // Check if this is a DOM manipulation error related to insertBefore
      if (event.error?.name === 'NotFoundError' && event.error?.message?.includes('insertBefore')) {
        logCriticalError(
          'ErrorPage - Unhandled DOM manipulation error (insertBefore)',
          safeSerialize(event.error),
        );
      }
    };

    const unhandledRejectionHandler = (event: PromiseRejectionEvent): void => {
      const error = event.reason;
      if (error?.name === 'NotFoundError' && error?.message?.includes('insertBefore')) {
        logCriticalError(
          'ErrorPage - Unhandled promise rejection with DOM manipulation error (insertBefore)',
          safeSerialize(error),
        );
      }
    };

    window.addEventListener('error', unhandledErrorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      window.removeEventListener('error', unhandledErrorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, [intl]);

  const badgeIcon = (() => {
    if (isNotFound) {
      return <ExploreOffRoundedIcon sx={{ fontSize: 32, color: '#FFFFFF' }} />;
    }
    if (isAccessError) {
      return <LockRoundedIcon sx={{ fontSize: 32, color: '#FFFFFF' }} />;
    }
    return <WarningAmberRoundedIcon sx={{ fontSize: 32, color: '#FFFFFF' }} />;
  })();

  return (
    <ErrorCanvas>
      <Header type="none" />

      <ErrorBody>
        <ErrorContent>
          <ErrorBadge>{badgeIcon}</ErrorBadge>

          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              fontFamily:
                '"SF Pro Rounded", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.02em',
              color: 'text.primary',
              mb: 1.5,
            }}
          >
            {headline}
          </Typography>

          <Typography
            variant="body1"
            component="p"
            sx={{
              mb: 3.5,
              color: 'text.secondary',
              fontSize: '1rem',
              lineHeight: 1.6,
            }}
          >
            {detailMessage}
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'center', alignItems: 'center' }}
          >
            {isNotFound && (
              <>
                <ApplePrimaryButton
                  variant="contained"
                  onClick={handleGoHome}
                  startIcon={<HomeRoundedIcon />}
                >
                  <FormattedMessage id="error.go-home" defaultMessage="Go to Home" />
                </ApplePrimaryButton>
                <AppleSecondaryButton
                  variant="outlined"
                  onClick={handleGoBack}
                  startIcon={<ArrowBackRoundedIcon />}
                >
                  <FormattedMessage id="error.go-back" defaultMessage="Go Back" />
                </AppleSecondaryButton>
              </>
            )}
            {isAccessError && (
              <ApplePrimaryButton
                variant="contained"
                component={RouterLink}
                to={`/c/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                startIcon={<LoginRoundedIcon />}
              >
                <FormattedMessage id="error.go-to-login" defaultMessage="Sign In" />
              </ApplePrimaryButton>
            )}
            {!isNotFound && !isAccessError && (
              <ApplePrimaryButton
                variant="contained"
                onClick={handleGoHome}
                startIcon={<HomeRoundedIcon />}
              >
                <FormattedMessage id="error.go-home" defaultMessage="Go to Home" />
              </ApplePrimaryButton>
            )}
          </Stack>
        </ErrorContent>
      </ErrorBody>
    </ErrorCanvas>
  );
};

export default ErrorPage;
