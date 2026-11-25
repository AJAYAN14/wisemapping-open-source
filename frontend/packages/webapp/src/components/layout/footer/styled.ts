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

/* Modern Minimalist Footer for Personal Private Edition */
export const StyledFooter = styled('footer')(({ theme }) => ({
  marginTop: 'auto',
  padding: '12px 24px',
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.35)' : '#f8f9fa',
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  justifyContent: 'center',

  '& .footer-inner': {
    maxWidth: '1200px',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 8px',
  },

  '& .footer-brand': {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    '& img': {
      height: '20px',
      opacity: 0.85,
    },
  },

  '& .copyright': {
    fontSize: '12px',
    color: theme.palette.text.secondary,
  },

  '& .footer-actions': {
    display: 'flex',
    alignItems: 'center',
  },
}));
