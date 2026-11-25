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

import React, { use, useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useLocation } from 'react-router';
import AccountAccessLayout from '../layout/AccountAccessLayout';
import GoogleButton from '../common/google-button';
import AppConfig from '../../classes/app-config';
import { ClientContext } from '../../classes/provider/client-context';
import { appLogger as log } from '../../utils/logger';
import AuthProgress from '../layout/auth-progress';
import { leaveTo, safeRedirectPath } from '../../utils/redirect';
import { startOAuthFlow, takeOAuthFlow } from '../../utils/oauth-flow';
import {
  AppleLoginCard,
  BrandBadge,
  TitleText,
  SubtitleText,
  SocialButtons,
  SecurityFootnote,
  AppleAlert,
} from './styled';

const LoginPage = (): React.ReactElement => {
  const intl = useIntl();
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const client = use(ClientContext);
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const redirectUrl = searchParams.get('redirect') ?? undefined;
  const oauthError = searchParams.get('error');

  useEffect(() => {
    if (oauthError) {
      takeOAuthFlow();
    }
  }, [oauthError]);

  const handleGoogleLogin = (): void => {
    const authUrl = AppConfig.getGoogleOauth2Url();
    if (AppConfig.isMockEnv()) {
      client.login({ email: 'a.jian0629@gmail.com', password: '' });
      leaveTo(safeRedirectPath(redirectUrl ?? '/c/maps'));
      return;
    }

    if (!authUrl) {
      log.warn('Google OAuth URL is not configured.');
      return;
    }

    let finalAuthUrl = authUrl;
    const target = redirectUrl ? safeRedirectPath(redirectUrl) : undefined;
    if (target) {
      const url = new URL(authUrl);
      url.searchParams.set('state', target);
      finalAuthUrl = url.toString();
    }
    startOAuthFlow(finalAuthUrl, target);
  };

  useEffect(() => {
    document.title = intl.formatMessage({
      id: 'login.page-title',
      defaultMessage: 'Login | WiseMapping',
    });
  }, [intl]);

  useEffect(() => {
    const checkAuthentication = async (): Promise<void> => {
      try {
        await client.fetchAccountInfo();
        leaveTo(safeRedirectPath(redirectUrl));
      } catch {
        setIsCheckingAuth(false);
      }
    };

    checkAuthentication();
  }, [client, redirectUrl]);

  if (isCheckingAuth) {
    return <AuthProgress />;
  }

  return (
    <AccountAccessLayout headerType="none" compact>
      <AppleLoginCard role="region" aria-label={intl.formatMessage({ id: 'login.page-title', defaultMessage: 'Login' })}>
        <BrandBadge aria-hidden="true">
          <svg width="40" height="30" viewBox="0 0 1510 1100" style={{ display: 'block' }}>
            <g stroke="#1D1D1D" strokeWidth="60" strokeLinejoin="round" strokeLinecap="round">
              <path
                d="M755 40 C1038 40 1268 212 1268 425 C1268 610 1125 720 960 818 C850 883 786 918 755 1000 C724 918 660 883 550 818 C385 720 242 610 242 425 C242 212 472 40 755 40 Z"
                fill="#FFCB00"
              />
              <path d="M650 300 Q755 205 860 300" fill="none" />
              <path
                d="M55 252 H682 C682 436 542 585 368.5 585 C195 585 55 436 55 252 Z M828 252 H1455 C1455 436 1315 585 1141.5 585 C968 585 828 436 828 252 Z"
                fill="#B3D4FF"
              />
            </g>
          </svg>
        </BrandBadge>

        <header>
          <TitleText variant="h4" component="h1">
            <FormattedMessage id="login.title" defaultMessage="Welcome" />
          </TitleText>

          <SubtitleText>
            <FormattedMessage id="login.desc" defaultMessage="Log into your account" />
          </SubtitleText>
        </header>

        {oauthError && (
          <AppleAlert severity="error">
            {oauthError === 'oauth_failed' && (
              <FormattedMessage
                id="login.oauth-error"
                defaultMessage="OAuth authentication failed. Please try again or use a different sign-in method."
              />
            )}
            {oauthError === 'server_error' && (
              <FormattedMessage
                id="login.server-error"
                defaultMessage="An unexpected error occurred. Please try again later."
              />
            )}
            {oauthError !== 'oauth_failed' && oauthError !== 'server_error' && (
              <FormattedMessage
                id="login.generic-error"
                defaultMessage="An error occurred during authentication. Please try again."
              />
            )}
          </AppleAlert>
        )}

        <SocialButtons>
          <GoogleButton
            text={intl.formatMessage({
              id: 'login.google.button',
              defaultMessage: 'Sign in with Google',
            })}
            onClick={handleGoogleLogin}
          />
        </SocialButtons>

        <SecurityFootnote>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.8 }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>个人私有专版 · Google 安全验证</span>
        </SecurityFootnote>
      </AppleLoginCard>
    </AccountAccessLayout>
  );
};

export default LoginPage;
