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

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

/**
 * Shared floating pane surface and section primitives aligned with the color-palette spec.
 */
export const PaneCard = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    paddingTop: '14px',
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingBottom: '14px',
    minWidth: 'min(290px, calc(100dvw - 32px))',
    maxWidth: 'min(340px, calc(100dvw - 24px))',
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(84, 84, 86, 0.45)' : 'rgba(60, 60, 67, 0.12)'}`,
    boxShadow: isDark
      ? '0 14px 36px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.30)'
      : '0 12px 32px rgba(0, 0, 0, 0.09), 0 2px 6px rgba(0, 0, 0, 0.04)',
    position: 'relative',
    color: theme.palette.text.primary,
    '@media (prefers-reduced-transparency: reduce)': {
      backgroundColor: theme.palette.background.paper,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
});

/** Flex header row inside popups so title & close button always align cleanly on opposite sides. */
export const PaneHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: theme.spacing(1.5),
}));

export const PaneHeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.82rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  lineHeight: 1.3,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
}));

/** Inline close button placed inside PaneHeader. */
export const PaneHeaderCloseButton = styled(IconButton)(({ theme }) => ({
  width: 26,
  height: 26,
  padding: 0,
  borderRadius: '7px',
  color: theme.palette.text.secondary,
  flexShrink: 0,
  transition: 'transform 120ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },
  '&:active': {
    transform: 'scale(0.92)',
  },
  '& svg': {
    fontSize: '17px',
  },
}));

/**
 * Legacy absolute close button kept for panes without PaneHeader; uses `&&` specificity so
 * StyledEngineProvider injectFirst cannot override `position: absolute` with MuiIconButton's `relative`.
 */
export const PaneCloseButton = styled(IconButton)(({ theme }) => ({
  '&&': {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 26,
    height: 26,
    borderRadius: '7px',
    color: theme.palette.text.secondary,
  },
  transition: 'transform 120ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },
  '&:active': {
    transform: 'scale(0.92)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '17px',
  },
}));

export const PaneSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1.75),
  '&:last-child': {
    marginBottom: 0,
  },
}));

export const PaneSectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
}));

/** Controls centred across the whole width of the pane. */
export const PaneCenteredRow = styled(Box)({
  display: 'flex',
  width: '100%',
  justifyContent: 'center',
});

/** Controls side by side, centred in both directions. */
export const PaneControlRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
  justifyContent: 'center',
}));

/** A vertical rule between two groups of controls in a row. */
export const PaneDivider = styled(Divider)(({ theme }) => ({
  marginLeft: theme.spacing(0.75),
  marginRight: theme.spacing(0.75),
  height: '28px',
  alignSelf: 'center',
}));
