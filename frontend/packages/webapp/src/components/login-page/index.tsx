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
import FormContainer from '../layout/form-container';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import GoogleButton from '../common/google-button';
import AppConfig from '../../classes/app-config';
import { ClientContext } from '../../classes/provider/client-context';
import { appLogger as log } from '../../utils/logger';
import AuthProgress from '../layout/auth-progress';
import { leaveTo, safeRedirectPath } from '../../utils/redirect';
import { startOAuthFlow, takeOAuthFlow } from '../../utils/oauth-flow';
import { SocialButtons } from './styled';

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
      <FormContainer>
        <header>
          <Typography variant="h4" component="h1">
            <FormattedMessage id="login.title" defaultMessage="Welcome" />
          </Typography>

          <Typography sx={{ marginBottom: '16px' }}>
            <FormattedMessage id="login.desc" defaultMessage="Log into your account" />
          </Typography>
        </header>

        {oauthError && (
          <Alert severity="error" sx={{ mb: 2 }}>
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
          </Alert>
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
      </FormContainer>
    </AccountAccessLayout>
  );
};

export default LoginPage;
