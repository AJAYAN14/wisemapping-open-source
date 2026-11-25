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
import { APPLE_FONT_STACK, appleColors, applePressMixin, isDarkTheme } from '../appleDesign';

export const DrawerContent = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflowX: 'hidden',
});

export const LogoBox = styled('div')({
  padding: '16px 16px 14px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minHeight: '60px',
  position: 'relative',
  overflow: 'hidden',
  userSelect: 'none',
});

export const LogoIcon = styled('img')({
  height: '28px',
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
    lineHeight: 1.05,
    fontFamily: APPLE_FONT_STACK,
    fontWeight: 800,
    fontSize: '15px',
    letterSpacing: '-0.02em',
    color: c.textPrimary,
    whiteSpace: 'nowrap',
    '& .logo-wise': {
      fontSize: '14px',
      fontWeight: 800,
      letterSpacing: '-0.01em',
    },
    '& .logo-mapping': {
      fontSize: '15px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
  };
});

export const SectionHeader = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    padding: '10px 14px 4px 18px',
    fontSize: '11.5px',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
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
    borderRadius: '8px',
    ...applePressMixin,
    '&:hover': {
      color: c.amber,
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
    '&:hover': {
      opacity: 1,
      color: c.textPrimary,
      backgroundColor: c.hoverFill,
    },
  };
});

/** The signed-in user's name and email, anchored at the bottom of the sidebar. */
export const UserInfoBox = styled(Box)(({ theme }) => {
  const isDark = isDarkTheme(theme);
  const c = appleColors(isDark);
  return {
    marginTop: 'auto',
    padding: '10px 12px',
    margin: 'auto 10px 12px 10px',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.68)',
    borderRadius: '12px',
    border: `1px solid ${c.hairline}`,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };
});

export const UserAvatarBadge = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '30px',
    height: '30px',
    borderRadius: '999px',
    backgroundColor: c.amber,
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    flexShrink: 0,
    fontFamily: APPLE_FONT_STACK,
  };
});

export const UserAvatarImage = styled('img')({
  width: '30px',
  height: '30px',
  borderRadius: '999px',
  objectFit: 'cover',
  flexShrink: 0,
});

export const UserName = styled(Typography)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    color: c.textPrimary,
    fontSize: '14px',
    fontWeight: 700,
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
    fontWeight: 500,
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
    '&:hover': {
      opacity: 1,
      color: '#EF4444',
      backgroundColor: c.hoverFill,
    },
  };
});
