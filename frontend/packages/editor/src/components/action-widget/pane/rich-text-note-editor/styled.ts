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
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import Select from '@mui/material/Select';
import { styled } from '@mui/material/styles';

/** The note editor's frame: toolbar on top, scrollable note body in the middle, footer pinned cleanly at the bottom. */
export const NoteEditorFrame = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    display: 'flex',
    flexDirection: 'column',
    width: 'min(620px, calc(100dvw - 32px))',
    height: 'min(450px, calc(100dvh - 110px))',
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(84, 84, 86, 0.45)' : 'rgba(60, 60, 67, 0.12)'}`,
    boxShadow: isDark
      ? '0 14px 36px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.30)'
      : '0 12px 32px rgba(0, 0, 0, 0.09), 0 2px 6px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    position: 'relative',
  };
});

export const CloseNoteButton = styled(IconButton)(({ theme }) => ({
  width: 28,
  height: 28,
  flexShrink: 0,
  borderRadius: '7px',
  color: theme.palette.text.secondary,
  transition: 'transform 120ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },
  '&:active': {
    transform: 'scale(0.92)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '18px',
  },
}));

export const ToolbarFrame = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    flexShrink: 0,
    minHeight: '52px',
    padding: `${theme.spacing(1)} ${theme.spacing(1.75)}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
  };
});

/** All the tools on one row, scrolling sideways when the window is narrow. */
export const ToolbarRow = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
  flexWrap: 'nowrap',
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': {
    display: 'none',
  },
}));

export const HeaderControl = styled(FormControl)({
  minWidth: 124,
  flexShrink: 0,
});

export const HeaderSelect = styled(Select)(({ theme }) => ({
  height: '32px',
  fontSize: '13px',
  borderRadius: '7px',
  backgroundColor: theme.palette.background.paper,
  borderColor: theme.palette.divider,
  '&:hover': {
    borderColor: theme.palette.text.secondary,
  },
  '&.Mui-focused': {
    borderColor: theme.palette.primary.main,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.divider,
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.text.secondary,
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.primary.main,
  },
}));

export const ToolGroup = styled(ButtonGroup)({
  flexShrink: 0,
  '& .MuiButtonGroup-grouped:not(:last-of-type)': {
    borderRightColor: 'transparent',
  },
});

export const ToolButton = styled(Button)(({ theme }) => ({
  minWidth: '32px',
  height: '32px',
  padding: '4px 6px',
  color: theme.palette.text.primary,
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    borderColor: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
  },
  '& .MuiSvgIcon-root': {
    fontSize: '18px',
  },
}));

export const NoteFrame = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  flexDirection: 'column',
}));

/** The editable note: lists, links and a slim scrollbar, in both colour modes. */
export const NoteEditable = styled(Box)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(2.5),
  overflow: 'auto',
  fontFamily: 'Arial, sans-serif',
  fontSize: '14px',
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  '& li > ul, & li > ol, & ul > ul, & ol > ol': { marginTop: 0, marginBottom: 0 },
  '& ul ul': { listStyleType: 'circle' },
  '& ul ul ul': { listStyleType: 'square' },
  '& ol ol': { listStyleType: 'lower-alpha' },
  '& ol ol ol': { listStyleType: 'lower-roman' },
  '& a': { color: theme.palette.primary.main, textDecoration: 'underline' },
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#f1f1f1',
    borderRadius: '4px',
    ...theme.applyStyles('dark', { backgroundColor: '#404040' }),
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#c1c1c1',
    borderRadius: '4px',
    ...theme.applyStyles('dark', { backgroundColor: '#606060' }),
    '&:hover': {
      backgroundColor: '#a8a8a8',
      ...theme.applyStyles('dark', { backgroundColor: '#707070' }),
    },
  },
}));

export const FooterBar = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? '#2C2C2E' : '#F9F9FB',
  };
});
