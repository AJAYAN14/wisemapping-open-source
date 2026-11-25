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

import { styled } from '@mui/material/styles';

/**
 * Apple Design macOS-style translucent frosted navigation header.
 */
export const StyledNav = styled('nav')(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    minHeight: '4rem',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: isDark ? 'rgba(28, 28, 32, 0.75)' : 'rgba(250, 250, 252, 0.75)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    display: 'flex',
    alignItems: 'center',
    '@media (prefers-reduced-transparency: reduce)': {
      backgroundColor: isDark ? '#1C1C20' : '#FAFAFC',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
});

export const StyledDiv = styled('div')`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 max(16px, env(safe-area-inset-left, 0px)) 0 max(16px, env(safe-area-inset-right, 0px));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  @media (min-width: 600px) {
    padding: 0 24px;
  }
`;

export const Logo = styled('span')`
  display: flex;
  align-items: center;

  .header-logo {
    display: inline-flex;
    align-items: center;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
    text-decoration: none;

    &:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }
    &:active {
      transform: scale(0.98);
    }
  }

  img {
    height: 32px;
    width: auto;
    display: block;
  }
`;
