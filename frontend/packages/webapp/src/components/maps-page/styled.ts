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

import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { CSSObject, styled, Theme } from '@mui/material/styles';
import {
  APPLE_FONT_STACK,
  appleColors,
  applePressMixin,
  glassMaterialMixin,
  isDarkTheme,
} from './appleDesign';

/** Expanded and collapsed desktop drawer widths in px. */
export const DRAWER_WIDTH_EXPANDED = 240;
export const DRAWER_WIDTH_COLLAPSED = 68;

const drawerWidthOf = (expanded: boolean): number =>
  expanded ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED;

const notExpanded = (prop: PropertyKey): boolean => prop !== 'expanded';

type ExpandedProps = {
  /** Whether the desktop drawer is expanded, showing its labels. */
  expanded: boolean;
};

/** On phones a toolbar button shows only its icon. */
const mobileAppbarButton: CSSObject = {
  padding: 0,
  minWidth: '38px',
  width: '38px',
  height: '38px',
  borderRadius: '10px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '@media (pointer: coarse)': {
    minWidth: '44px',
    minHeight: '44px',
    width: '44px',
    height: '44px',
  },
  '& .message': {
    display: 'none',
  },
  '& .MuiButton-startIcon': {
    margin: 0,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '& .MuiButton-endIcon': {
    display: 'none',
  },
};

/** The drawer's floating card surface on desktop, and full-height sheet on phones. */
const drawerPaper = (theme: Theme, expanded: boolean): CSSObject => {
  const isDark = isDarkTheme(theme);
  const c = appleColors(isDark);
  return {
    ...glassMaterialMixin(c.sidebarGlass, c.sidebarSolid, 24),
    backgroundColor: c.surface,
    color: c.textPrimary,
    border: `1px solid ${c.hairline}`,
    borderRadius: '16px',
    boxShadow: c.shadowSubtle,
    boxSizing: 'border-box',
    overflow: 'hidden',
    top: '12px',
    left: '12px',
    bottom: '12px',
    height: 'calc(100dvh - 24px)',
    width: `var(--drawer-width, ${drawerWidthOf(expanded)}px)`,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    [theme.breakpoints.down('sm')]: {
      top: 0,
      left: 0,
      bottom: 0,
      borderRadius: 0,
      border: 'none',
      borderRight: `1px solid ${c.hairline}`,
      boxShadow: 'none',
      width: 'min(240px, 80dvw, 100dvw - 24px)',
      height: '100svh',
      maxHeight: '100svh',
      backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
};

const desktopDrawer = (theme: Theme, expanded: boolean): CSSObject => {
  const c = appleColors(isDarkTheme(theme));
  const fallbackWidth = `${drawerWidthOf(expanded)}px`;
  return {
    width: `var(--drawer-width, ${fallbackWidth})`,
    flexShrink: 0,
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    '& .MuiDrawer-paper': {
      overflowX: 'hidden',
      boxSizing: 'border-box',
    },
    '& .MuiListItemText-root': {
      display: expanded ? 'block' : 'none !important',
      marginLeft: '4px',
      opacity: expanded ? 1 : 0,
      transition: 'opacity 140ms ease',
      '& .MuiTypography-root': {
        fontSize: '14.5px',
        fontWeight: 600,
        letterSpacing: '-0.005em',
        fontFamily: APPLE_FONT_STACK,
      },
      ...(!expanded && {
        display: 'none !important',
        color: 'transparent',
        pointerEvents: 'none',
        '& span': { color: 'transparent' },
      }),
    },
    '& .MuiListItemIcon-root': {
      minWidth: expanded ? '24px' : 'auto',
      width: expanded ? 'auto' : '24px',
      height: expanded ? 'auto' : '24px',
      marginRight: expanded ? '8px' : '0px',
      justifyContent: 'center',
      alignItems: 'center',
      display: 'inline-flex',
      color: c.textSecondary,
      '& .MuiSvgIcon-root': {
        fontSize: '19px',
        display: 'block',
      },
    },
    '& .MuiListItem-root': {
      paddingTop: '2px',
      paddingBottom: '2px',
      minHeight: '38px',
      ...(!expanded && {
        padding: 0,
        minHeight: '44px',
        display: 'flex',
        justifyContent: 'center',
      }),
    },
    '& .MuiListItemButton-root': {
      paddingTop: '8px',
      paddingBottom: '8px',
      paddingLeft: expanded ? '12px' : 0,
      paddingRight: expanded ? '12px' : 0,
      minHeight: expanded ? '40px' : '44px',
      width: expanded ? 'auto' : '44px',
      height: expanded ? 'auto' : '44px',
      borderRadius: '12px',
      margin: expanded ? '2px 10px' : '2px auto',
      justifyContent: expanded ? 'flex-start' : 'center',
      alignItems: 'center',
      ...applePressMixin,
      '&:hover': {
        backgroundColor: c.hoverFill,
      },
      '&.Mui-selected': {
        backgroundColor: c.amberSoft,
        color: c.amberText,
        '& .MuiListItemText-root .MuiTypography-root': {
          fontWeight: 700,
        },
        '& .MuiListItemIcon-root': {
          color: c.amber,
        },
        '&:hover': {
          backgroundColor: c.amberSoftHover,
        },
      },
    },
    '& .filter-count-badge': {
      ...(!expanded && { display: 'none !important' }),
    },
    '& .MuiListItemSecondaryAction-root, & .poweredByIcon': {
      display: 'block',
      ...(!expanded && { display: 'none' }),
    },
  };
};

export const PageRoot = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    minHeight: '100dvh',
    backgroundColor: c.canvas,
    color: c.textPrimary,
    fontFamily: APPLE_FONT_STACK,
    boxSizing: 'border-box',
    [theme.breakpoints.up('sm')]: {
      padding: '12px',
      gap: '12px',
    },
  };
});

/** Translucent floating top bar aligned with the sidebar via --drawer-width. */
export const PageAppBar = styled(AppBar, { shouldForwardProp: notExpanded })<ExpandedProps>(({
  theme,
  expanded,
}) => {
  const c = appleColors(isDarkTheme(theme));
  const fallbackWidth = drawerWidthOf(expanded);
  return {
    '&&': {
      ...glassMaterialMixin(c.headerGlass, c.headerSolid, 20),
      color: c.textPrimary,
      boxShadow: 'none',
      border: 'none',
      borderBottom: `1px solid ${c.hairline}`,
    },
    zIndex: theme.zIndex.drawer + 1,
    marginLeft: `var(--drawer-width, ${fallbackWidth}px)`,
    width: `calc(100% - var(--drawer-width, ${fallbackWidth}px))`,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    '& .MuiToolbar-root': {
      backgroundColor: 'transparent',
      minHeight: '3.75rem',
      paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
      paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
      gap: '8px',
    },
    [theme.breakpoints.down('sm')]: {
      marginLeft: 0,
      width: '100%',
      '& .MuiToolbar-root': {
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      },
    },
  };
});

/** Opens the drawer on phones. */
export const MobileDrawerToggle = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    marginRight: theme.spacing(0.5),
    borderRadius: '10px',
    color: c.textSecondary,
    ...applePressMixin,
    '@media (pointer: coarse)': {
      minWidth: '44px',
      minHeight: '44px',
    },
    '&:hover': {
      backgroundColor: c.hoverFill,
      color: c.textPrimary,
    },
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  };
});

/** Expands or collapses the drawer from tablets up. */
export const DesktopDrawerToggle = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '34px',
    height: '34px',
    padding: 0,
    marginRight: '6px',
    borderRadius: '10px',
    color: c.textSecondary,
    ...applePressMixin,
    '@media (pointer: coarse)': {
      minWidth: '44px',
      minHeight: '44px',
    },
    '&:hover': {
      backgroundColor: c.hoverFill,
      color: c.textPrimary,
    },
    '& .collapsed-logo': {
      position: 'absolute',
      width: '24px',
      height: '24px',
      transition: 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      opacity: 1,
      transform: 'scale(1)',
      pointerEvents: 'none',
      display: 'block',
    },
    '& .collapsed-expand-icon': {
      position: 'absolute',
      width: '24px',
      height: '24px',
      transition: 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      opacity: 0,
      transform: 'scale(0.82)',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: c.textPrimary,
      '& svg': {
        fontSize: '22px',
      },
    },
    '&:hover .collapsed-logo, &:focus-visible .collapsed-logo': {
      opacity: 0,
      transform: 'scale(0.82)',
    },
    '&:hover .collapsed-expand-icon, &:focus-visible .collapsed-expand-icon': {
      opacity: 1,
      transform: 'scale(1)',
    },
    [theme.breakpoints.up('xs')]: {
      display: 'none',
    },
    [theme.breakpoints.up('sm')]: {
      display: 'inline-flex',
    },
  };
});

/** Primary CTA ("New map") — warm amber pill with bold rounded presence. */
export const PrimaryToolbarButton = styled(Button)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    borderRadius: '11px',
    height: '36px',
    fontSize: '0.84rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    padding: '6px 14px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: APPLE_FONT_STACK,
    backgroundColor: c.amber,
    color: '#FFFFFF',
    border: `1px solid ${isDarkTheme(theme) ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.35)'}`,
    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.28)',
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.amberHover,
      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.32)',
    },
    '& .MuiButton-startIcon svg': {
      fontSize: '18px',
    },
    [theme.breakpoints.down('sm')]: mobileAppbarButton,
  };
});

/** Secondary CTA ("Import") — subtle neutral glass button replacing the harsh orange border. */
export const SecondaryToolbarButton = styled(Button)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    borderRadius: '11px',
    height: '36px',
    fontSize: '0.84rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    padding: '6px 12px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: APPLE_FONT_STACK,
    backgroundColor: c.surface,
    color: c.textPrimary,
    border: `1px solid ${c.hairline}`,
    boxShadow: c.shadowSubtle,
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.hoverFill,
      borderColor: c.hairlineStrong,
    },
    '& .MuiButton-startIcon': {
      color: c.textSecondary,
    },
    '& .MuiButton-startIcon svg': {
      fontSize: '18px',
    },
    [theme.breakpoints.down('sm')]: mobileAppbarButton,
  };
});

/** The theme and account menus, at the right of the toolbar. */
export const RightButtonGroup = styled('div')(({ theme }) => ({
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '8px',
  [theme.breakpoints.down('sm')]: {
    gap: '4px',
  },
}));

/** The drawer phones open from the toolbar. */
export const MobileDrawer = styled(Drawer, { shouldForwardProp: notExpanded })<ExpandedProps>(
  ({ theme, expanded }) => [
    {
      display: 'none',
      [theme.breakpoints.down('sm')]: {
        display: 'block',
        '& .MuiDrawer-paper': {
          width: 'min(240px, 80dvw, 100dvw - 24px)',
        },
        '& .MuiListItemButton-root': {
          borderRadius: '10px',
          margin: '2px 10px',
        },
      },
    },
    { '& .MuiPaper-root': drawerPaper(theme, expanded) },
  ],
);

/** The drawer always shown from tablets up, expanded or collapsed to its icons. */
export const DesktopDrawer = styled(Drawer, { shouldForwardProp: notExpanded })<ExpandedProps>(
  ({ theme, expanded }) => [
    desktopDrawer(theme, expanded),
    { '& .MuiPaper-root': drawerPaper(theme, expanded) },
  ],
);

export const PageContent = styled('main')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    flexGrow: 1,
    minWidth: 0,
    containerType: 'inline-size',
    containerName: 'maps-main',
    boxSizing: 'border-box',
    [theme.breakpoints.up('sm')]: {
      backgroundColor: c.surface,
      borderRadius: '16px',
      border: `1px solid ${c.hairline}`,
      boxShadow: c.shadowSubtle,
      minHeight: 'calc(100dvh - 24px)',
      overflowX: 'hidden',
      paddingTop: '14px',
      paddingBottom: '24px',
    },
    [theme.breakpoints.down('sm')]: {
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom, 0px))',
      paddingInlineStart: 'env(safe-area-inset-left, 0px)',
      paddingInlineEnd: 'env(safe-area-inset-right, 0px)',
    },
  };
});

/** Mobile-only top strip inside the workspace for opening the drawer. */
export const WorkspaceTopBar = styled('header')(({ theme }) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px 0 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  minHeight: '40px',
  [theme.breakpoints.up('sm')]: {
    display: 'none',
  },
}));

/** Keeps the content below the fixed translucent app bar. */
export const ToolbarSpacer = styled('div')({
  display: 'flex',
  justifyContent: 'flex-end',
  minHeight: 'calc(3.75rem + env(safe-area-inset-top, 0px))',
});
