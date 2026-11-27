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
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Toolbar from '@mui/material/Toolbar';
import { alpha, styled } from '@mui/material/styles';
import { APPLE_FONT_STACK, appleColors, glassMaterialMixin, isDarkTheme } from '../appleDesign';

// The loading placeholder of the map page (see MapsListSkeleton).

const DRAWER_WIDTH_EXPANDED = 240;
const DRAWER_WIDTH_COLLAPSED = 68;

const notExpanded = (prop: PropertyKey): boolean => prop !== 'expanded';

type ExpandedProps = {
  expanded: boolean;
};

const drawerWidthOf = (expanded: boolean): number =>
  expanded ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED;

export const DrawerSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(theme.palette.common.white, 0.1),
  }),
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    '&::after': {
      animation: 'none',
    },
  },
}));

export const LoadingAppBar = styled(AppBar, { shouldForwardProp: notExpanded })<ExpandedProps>(({
  theme,
  expanded,
}) => {
  const c = appleColors(isDarkTheme(theme));
  const width = drawerWidthOf(expanded);
  return {
    '&&': {
      ...glassMaterialMixin(c.headerGlass, c.headerSolid, 20),
      boxShadow: 'none',
      border: 'none',
      borderBottom: `1px solid ${c.hairline}`,
    },
    marginLeft: width,
    width: `calc(100% - ${width}px)`,
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

export const LoadingContainer = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    minHeight: '100dvh',
    backgroundColor: c.canvas,
    fontFamily: APPLE_FONT_STACK,
    boxSizing: 'border-box',
    [theme.breakpoints.up('sm')]: {
      padding: '12px',
      gap: '12px',
    },
  };
});

export const LoadingDrawer = styled('div', { shouldForwardProp: notExpanded })<ExpandedProps>(({
  theme,
  expanded,
}) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: drawerWidthOf(expanded),
    flexShrink: 0,
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    borderRadius: '16px',
    boxShadow: c.shadowSubtle,
    height: 'calc(100dvh - 24px)',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    overflowX: 'hidden',
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  };
});

export const LoadingDrawerLogo = styled('div', { shouldForwardProp: notExpanded })<ExpandedProps>(
  ({ expanded }) => ({
    padding: '16px 16px 14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: expanded ? 'flex-start' : 'center',
    gap: '10px',
    minHeight: '60px',
  }),
);

export const LoadingDrawerSectionHeader = styled('div')({
  padding: '10px 14px 4px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const LoadingDrawerList = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  paddingTop: '4px',
  paddingBottom: '4px',
});

export const LoadingDrawerItem = styled('div', {
  shouldForwardProp: (prop) => prop !== 'expanded' && prop !== 'selected',
})<{ expanded: boolean; selected?: boolean }>(({ theme, expanded, selected }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: expanded ? 'flex-start' : 'center',
    gap: expanded ? '10px' : 0,
    padding: expanded ? '8px 12px' : '8px 14px',
    minHeight: '40px',
    borderRadius: '12px',
    margin: '2px 10px',
    backgroundColor: selected ? c.amberSoft : 'transparent',
  };
});

export const LoadingDrawerUserCard = styled('div')(({ theme }) => {
  const isDark = isDarkTheme(theme);
  const c = appleColors(isDark);
  return {
    marginTop: 'auto',
    margin: 'auto 10px 12px 10px',
    padding: '10px 12px',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    borderRadius: '12px',
    border: `1px solid ${c.hairline}`,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };
});

export const LoadingMainContent = styled('main')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    flexGrow: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    [theme.breakpoints.up('sm')]: {
      backgroundColor: c.surface,
      borderRadius: '16px',
      border: `1px solid ${c.hairline}`,
      boxShadow: c.shadowSubtle,
      minHeight: 'calc(100dvh - 24px)',
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

export const LoadingToolbarSpacer = styled('div')({
  minHeight: 'calc(3.75rem + env(safe-area-inset-top, 0px))',
});

export const LoadingSearchToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '12px',
  padding: 0,
  paddingTop: '14px',
  paddingBottom: '18px',
  minHeight: '56px',
  boxShadow: 'none',
  backgroundColor: 'transparent',
  [theme.breakpoints.down('sm')]: {
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
  },
}));

export const LoadingHeadingCluster = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minWidth: 0,
});

export const LoadingSearchCluster = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginLeft: 'auto',
  [theme.breakpoints.down('sm')]: {
    flexBasis: '100%',
    width: '100%',
    marginLeft: 0,
  },
}));

export const LoadingSearchBox = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    width: '248px',
    height: '36px',
    padding: '0 10px 0 12px',
    borderRadius: '12px',
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    boxShadow: c.shadowSubtle,
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  };
});

export const SkeletonBlock = styled(Skeleton)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.common.black, 0.08),
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(theme.palette.common.white, 0.1),
  }),
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    '&::after': {
      animation: 'none',
    },
  },
}));

export const SkeletonAmberBlock = styled(SkeletonBlock)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    backgroundColor: alpha(c.amber, isDarkTheme(theme) ? 0.24 : 0.2),
  };
});

export const SkeletonButton = styled(SkeletonBlock)({
  borderRadius: '12px',
});

export const SkeletonText = styled(SkeletonBlock)({
  fontSize: '0.96rem',
});

/** The table's card, as wide as the maps list it stands for. */
export const LoadingListPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: 'transparent',
  width: '100%',
  maxWidth: 'none',
  boxSizing: 'border-box',
  margin: '0 0 8px 0',
  paddingLeft: '28px',
  paddingRight: '28px',
  [theme.breakpoints.down('md')]: {
    paddingLeft: '20px',
    paddingRight: '20px',
  },
  [theme.breakpoints.down('sm')]: {
    marginTop: 0,
    paddingLeft: '6px',
    paddingRight: '6px',
  },
}));

export const LoadingTableContainer = styled(TableContainer)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    borderRadius: '18px',
    boxShadow: c.shadowSubtle,
    overflowX: 'auto',
    overflowY: 'hidden',
    maxWidth: '100%',
  };
});

export const LoadingHeaderCell = styled(TableCell)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    backgroundColor: c.surface,
    borderBottom: `1px solid ${c.hairline}`,
    borderTop: 0,
    borderLeft: 0,
    borderRight: 0,
    padding: '11px 14px',
  };
});
