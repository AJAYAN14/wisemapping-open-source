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

import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';
import { PaneCard } from '../shared/StyledPane';

export const FontPaneContainer = styled(PaneCard)(({ theme }) => ({
  paddingTop: theme.spacing(1.75),
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  paddingBottom: theme.spacing(1.75),
  minWidth: 'min(290px, calc(100dvw - 32px))',
}));

/** A bold, italic... toggle: highlighted with HIG systemBlue when active. */
export const ActionButton = styled(IconButton)<{ selected?: boolean }>(({ selected, theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    padding: '4px',
    width: '36px',
    height: '32px',
    borderRadius: '8px',
    border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
    color: selected ? theme.palette.primary.main : theme.palette.text.primary,
    backgroundColor: selected
      ? isDark
        ? 'rgba(10, 132, 255, 0.18)'
        : 'rgba(0, 122, 255, 0.12)'
      : isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(120, 120, 128, 0.08)',
    transition:
      'background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 120ms ease',
    '&:hover': {
      borderColor: selected ? theme.palette.primary.main : theme.palette.text.secondary,
      backgroundColor: selected
        ? isDark
          ? 'rgba(10, 132, 255, 0.24)'
          : 'rgba(0, 122, 255, 0.18)'
        : theme.palette.action.hover,
    },
    '&:active': {
      transform: 'scale(0.95)',
    },
  };
});

export const ResetSection = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.75),
  paddingTop: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

export const ResetButton = styled(Button)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    textTransform: 'none',
    fontSize: '0.78rem',
    fontWeight: 500,
    borderRadius: '8px',
    paddingTop: theme.spacing(0.75),
    paddingBottom: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(120, 120, 128, 0.08)',
    '&:hover': {
      color: theme.palette.error.main,
      borderColor: theme.palette.error.main,
      backgroundColor: isDark ? 'rgba(255, 69, 58, 0.14)' : 'rgba(255, 59, 48, 0.08)',
    },
  };
});
