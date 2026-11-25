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

import React from 'react';
import Box from '@mui/material/Box';
import Header from './header';
import { LayoutContent } from './styled';
import { useTheme } from '@mui/material/styles';

type AccountAccessLayoutProps = {
  headerType: 'only-signin' | 'none';
  children: React.ReactNode;
  /** Less padding around the content, for the long sign-in and sign-up forms. */
  compact?: boolean;
};

const AccountAccessLayout = ({
  headerType,
  children,
  compact = false,
}: AccountAccessLayoutProps): React.ReactElement => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: isDark ? '#161618' : '#F5F5F7',
        backgroundImage: isDark
          ? 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255, 159, 10, 0.08) 0%, transparent 70%), linear-gradient(180deg, #1C1C1E 0%, #161618 100%)'
          : 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(245, 158, 11, 0.08) 0%, transparent 70%), linear-gradient(180deg, #FAFAFC 0%, #EFF0F4 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <Header type={headerType} />
      <LayoutContent compact={compact}>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {children}
        </Box>
      </LayoutContent>
    </Box>
  );
};

export default AccountAccessLayout;
