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
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import {
  APPLE_FONT_STACK,
  RADIUS_MD,
  appleColors,
  applePressMixin,
  isDarkTheme,
} from '../appleDesign';

export const DrawerContent = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

export const LogoBox = styled('div')({
  padding: '14px 14px 12px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minHeight: '56px',
  position: 'relative',
  overflow: 'hidden',
  userSelect: 'none',
});

export const LogoIcon = styled('img')({
  height: '24px',
  width: 'auto',
  flexShrink: 0,
  display: 'block',
});

export const LogoText = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    lineHeight: 1.08,
    fontFamily: APPLE_FONT_STACK,
    fontWeight: 700,
    fontSize: '14px',
    letterSpacing: '-0.02em',
    color: c.textPrimary,
    whiteSpace: 'nowrap',
    '& .logo-wise': {
      fontSize: '13.5px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    '& .logo-mapping': {
      fontSize: '14px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
  };
});

export const SectionHeader = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    padding: '10px 14px 4px 14px',
    fontSize: '11.5px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    color: c.textTertiary,
    fontFamily: APPLE_FONT_STACK,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
});

export const SectionActionButton = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    padding: '3px',
    color: c.textTertiary,
    borderRadius: RADIUS_MD,
    ...applePressMixin,
    '@media (pointer: coarse)': {
      minWidth: '44px',
      minHeight: '44px',
    },
    '&:hover': {
      color: c.textPrimary,
      backgroundColor: c.hoverFill,
    },
  };
});

export const FolderItemRoot = styled(Box)({
  position: 'relative',
  '&:hover .folder-more-button, &:focus-within .folder-more-button': {
    opacity: '1 !important',
  },
});

export const FolderMoreButton = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    opacity: 0,
    transition: 'opacity 0.16s ease, color 0.14s ease, background-color 0.14s ease',
    padding: '3px',
    borderRadius: '8px',
    color: c.textTertiary,
    '@media (hover: none), (pointer: coarse)': {
      opacity: 0.75,
      minWidth: '44px',
      minHeight: '44px',
    },
    '&:hover': {
      opacity: 1,
      color: c.textPrimary,
      backgroundColor: c.hoverFill,
    },
  };
});

/** The signed-in user's name and email, anchored at the bottom of the sidebar. */
export const UserInfoBox = styled(Box)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    marginTop: 'auto',
    padding: '8px 10px',
    margin: 'auto 8px 10px 8px',
    backgroundColor: c.hoverFill,
    borderRadius: RADIUS_MD,
    border: `1px solid ${c.hairline}`,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };
});

export const UserAvatarBadge = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    backgroundColor: c.ctaPrimary,
    color: c.ctaPrimaryText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
    fontFamily: APPLE_FONT_STACK,
  };
});

export const UserAvatarImage = styled('img')({
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  objectFit: 'cover',
  flexShrink: 0,
});

export const UserName = styled(Typography)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    color: c.textPrimary,
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.25,
    fontFamily: APPLE_FONT_STACK,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
});

export const UserEmail = styled(Typography)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    color: c.textSecondary,
    fontSize: '11.5px',
    fontWeight: 400,
    lineHeight: 1.3,
    fontFamily: APPLE_FONT_STACK,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  };
});

/** A filter entry; its delete button shows on hover. */
export const FilterItemRoot = styled(Box)({
  position: 'relative',
  '&:hover .label-delete-button, &:focus-within .label-delete-button': {
    opacity: '1 !important',
  },
});

export const FilterListItemButton = styled(ListItemButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    color: c.textPrimary,
    ...applePressMixin,
    '&.Mui-selected': {
      backgroundColor: c.amberSoft,
      color: c.amberText,
      '& .MuiListItemIcon-root': {
        color: c.amber,
      },
      '&:hover': {
        backgroundColor: c.amberSoftHover,
      },
    },
    '&:hover ~ .MuiListItemSecondaryAction-root .label-delete-button': {
      opacity: '1 !important',
    },
  };
});

/** Deletes a label filter; hidden until its entry is hovered. */
export const DeleteLabelButton = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    opacity: 0,
    transition: 'opacity 0.16s ease, color 0.14s ease, background-color 0.14s ease',
    padding: '4px',
    color: c.textTertiary,
    '@media (hover: none), (pointer: coarse)': {
      opacity: 0.75,
      minWidth: '44px',
      minHeight: '44px',
    },
    '&:hover': {
      opacity: 1,
      color: '#EF4444',
      backgroundColor: c.hoverFill,
    },
  };
});
