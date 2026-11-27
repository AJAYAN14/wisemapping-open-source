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
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export const PanelContainer = styled(Paper)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    width: '330px',
    maxWidth: '88vw',
    padding: theme.spacing(1.75),
    borderRadius: '16px',
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    border: `1px solid ${isDark ? 'rgba(84, 84, 86, 0.45)' : 'rgba(60, 60, 67, 0.12)'}`,
    boxShadow: isDark
      ? '0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3)'
      : '0 16px 36px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
    color: theme.palette.text.primary,
  };
});

export const HeaderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const MatchCounter = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  minWidth: '48px',
  textAlign: 'center',
}));

export const ResultsList = styled(Box)({
  maxHeight: '280px',
  overflowY: 'auto',
  marginTop: '8px',
});

export const ResultItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: theme.spacing(0.75, 1),
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  backgroundColor: active ? theme.palette.action.selected : 'transparent',
  border: `1px solid ${active ? theme.palette.primary.main : 'transparent'}`,
  '&:hover': {
    backgroundColor: active ? theme.palette.action.selected : theme.palette.action.hover,
  },
}));

export const HighlightedMatch = styled('mark')(({ theme }) => ({
  backgroundColor: theme.palette.warning.light,
  color: theme.palette.getContrastText(theme.palette.warning.light),
  borderRadius: '2px',
  padding: '0 1px',
}));

export const EmptyState = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.8rem',
  padding: theme.spacing(1, 0.5),
}));
