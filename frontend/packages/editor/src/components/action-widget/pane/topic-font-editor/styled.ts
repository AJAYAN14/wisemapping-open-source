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
import { StyledEditorContainer } from '../shared/StyledEditorContainer';

export const FontPaneContainer = styled(StyledEditorContainer)(({ theme }) => ({
  paddingTop: theme.spacing(2),
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  paddingBottom: theme.spacing(1),
}));

/** A bold, italic... toggle: outlined in the primary colour while it is on. */
export const ActionButton = styled(IconButton)<{ selected?: boolean }>(({ selected, theme }) => ({
  padding: '8px',
  width: '32px',
  height: '32px',
  border: selected
    ? `2px solid ${theme.palette.primary.main}`
    : `2px solid ${theme.palette.divider}`,
  borderRadius: '4px',
  backgroundColor: selected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
  ...(selected && theme.applyStyles('dark', { backgroundColor: 'rgba(144, 202, 249, 0.08)' })),
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

export const ResetSection = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  paddingTop: theme.spacing(2),
  borderTop: '1px solid',
  borderColor: theme.palette.divider,
}));

export const ResetButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '0.75rem',
  paddingTop: theme.spacing(0.75),
  paddingBottom: theme.spacing(0.75),
}));
