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
 * The parts the style panes (canvas, topic, font, relationship) are made of: a card with a close
 * button, sections with a small title, and centred rows of controls.
 */
export const PaneCard = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    paddingTop: theme.spacing(1.75),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingBottom: theme.spacing(1.5),
    minWidth: '290px',
    maxWidth: '330px',
    backgroundColor: isDark ? 'rgba(32, 32, 36, 0.88)' : 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: '16px',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
    boxShadow: isDark
      ? '0 12px 36px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.25)'
      : '0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
    position: 'relative',
    '@media (prefers-reduced-transparency: reduce)': {
      backgroundColor: theme.palette.background.paper,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
});

export const PaneCloseButton = styled(IconButton)({
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 1,
  width: 26,
  height: 26,
  borderRadius: '8px',
  transition: 'transform 120ms ease, background-color 150ms ease',
  '&:active': {
    transform: 'scale(0.92)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '16px',
  },
});

export const PaneSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

export const PaneSectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Text", system-ui, sans-serif',
}));

/** Controls centred across the whole width of the pane. */
export const PaneCenteredRow = styled(Box)({
  display: 'flex',
  width: '100%',
  justifyContent: 'center',
});

/** A few buttons side by side, centred. */
export const PaneButtonRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  justifyContent: 'center',
}));

/** Controls side by side, centred in both directions. */
export const PaneControlRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
  justifyContent: 'center',
}));

/** A vertical rule between two groups of controls in a row. */
export const PaneDivider = styled(Divider)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  marginRight: theme.spacing(1),
  height: '32px',
  alignSelf: 'center',
}));
