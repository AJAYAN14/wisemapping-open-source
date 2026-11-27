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

import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Toolbar from '@mui/material/Toolbar';
import { alpha, styled } from '@mui/material/styles';
import {
  APPLE_FONT_STACK,
  RADIUS_LG,
  RADIUS_MD,
  RADIUS_SM,
  appleColors,
  isDarkTheme,
} from '../appleDesign';

// The loading placeholder of the map page (see MapsListSkeleton).

const DRAWER_WIDTH_EXPANDED = 236;
const DRAWER_WIDTH_COLLAPSED = 64;

const notExpanded = (prop: PropertyKey): boolean => prop !== 'expanded';

type ExpandedProps = {
  expanded: boolean;
};

const drawerWidthOf = (expanded: boolean): number =>
  expanded ? DRAWER_WIDTH_EXPANDED : DRAWER_WIDTH_COLLAPSED;

export const DrawerSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.text.primary, 0.07),
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(theme.palette.common.white, 0.09),
  }),
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    '&::after': {
      animation: 'none',
    },
  },
}));

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
    borderRadius: RADIUS_LG,
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
    padding: '14px 14px 12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: expanded ? 'flex-start' : 'center',
    gap: '10px',
    minHeight: '56px',
  }),
);

export const LoadingDrawerSectionHeader = styled('div')({
  padding: '10px 14px 4px 14px',
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
    padding: expanded ? '7px 10px' : 0,
    minHeight: expanded ? '36px' : '40px',
    width: expanded ? 'auto' : '40px',
    height: expanded ? 'auto' : '40px',
    borderRadius: RADIUS_MD,
    margin: expanded ? '2px 8px' : '2px auto',
    backgroundColor: selected ? c.amberSoft : 'transparent',
  };
});

export const LoadingDrawerFooter = styled('div', { shouldForwardProp: notExpanded })<ExpandedProps>(
  ({ expanded }) => ({
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: expanded ? 'stretch' : 'center',
    gap: '6px',
    paddingBottom: expanded ? '10px' : '12px',
  }),
);

export const LoadingDrawerQuickGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '6px',
  margin: '0 8px',
});

export const LoadingDrawerQuickPill = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    height: '34px',
    borderRadius: RADIUS_MD,
    border: `1px solid ${c.hairline}`,
    backgroundColor: c.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '0 8px',
  };
});

export const LoadingDrawerUserCard = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    margin: '0 8px',
    padding: '8px 10px',
    backgroundColor: c.hoverFill,
    borderRadius: RADIUS_MD,
    border: `1px solid ${c.hairline}`,
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
  };
});

/** Transparent main workspace matching PageContent. */
export const LoadingMainContent = styled('main')(({ theme }) => ({
  flexGrow: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  [theme.breakpoints.up('sm')]: {
    backgroundColor: 'transparent',
    minHeight: 'calc(100dvh - 24px)',
    paddingTop: '6px',
    paddingBottom: '28px',
  },
  [theme.breakpoints.down('sm')]: {
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom, 0px))',
    paddingInlineStart: 'env(safe-area-inset-left, 0px)',
    paddingInlineEnd: 'env(safe-area-inset-right, 0px)',
  },
}));

export const LoadingSearchToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '10px',
  padding: 0,
  paddingTop: '4px',
  paddingBottom: '16px',
  minHeight: '48px',
  boxShadow: 'none',
  backgroundColor: 'transparent',
  [theme.breakpoints.down('sm')]: {
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
  },
}));

export const LoadingSegmentedGroup = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: '34px',
    boxSizing: 'border-box',
    padding: '3px',
    borderRadius: RADIUS_MD,
    backgroundColor: c.hoverFill,
    border: `1px solid ${c.hairline}`,
    gap: '2px',
  };
});

export const LoadingSegmentedTab = styled('div', {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    height: '26px',
    padding: '0 10px',
    borderRadius: RADIUS_SM,
    backgroundColor: active ? c.surface : 'transparent',
    boxShadow: active ? c.shadowSubtle : 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  };
});

export const LoadingSearchCluster = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
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
    width: '220px',
    height: '34px',
    boxSizing: 'border-box',
    padding: '0 10px 0 11px',
    borderRadius: RADIUS_MD,
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    [theme.breakpoints.down('sm')]: {
      flex: 1,
      width: '100%',
    },
  };
});

export const LoadingToolbarPill = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    height: '34px',
    boxSizing: 'border-box',
    borderRadius: RADIUS_MD,
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 10px',
    gap: '6px',
  };
});

export const SkeletonBlock = styled(Skeleton)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.common.black, 0.065),
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(theme.palette.common.white, 0.085),
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
    backgroundColor: alpha(c.amber, isDarkTheme(theme) ? 0.22 : 0.16),
  };
});

export const SkeletonButton = styled(SkeletonBlock)({
  borderRadius: RADIUS_MD,
});

export const SkeletonText = styled(SkeletonBlock)({
  fontSize: '0.9rem',
});

/** The list container, matching ListPaper max-width and horizontal edges. */
export const LoadingListPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: 'transparent',
  width: '100%',
  maxWidth: '1440px',
  boxSizing: 'border-box',
  margin: '0 auto 8px auto',
  paddingLeft: '24px',
  paddingRight: '24px',
  [theme.breakpoints.down('md')]: {
    paddingLeft: '16px',
    paddingRight: '16px',
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
    borderRadius: RADIUS_LG,
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
    padding: '10px 14px',
  };
});

export const LoadingGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(236px, 1fr))',
  gap: '16px',
  width: '100%',
});

export const LoadingGridCard = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: RADIUS_LG,
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    boxShadow: c.shadowSubtle,
    overflow: 'hidden',
  };
});

export const LoadingGridPreview = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '100%',
    aspectRatio: '16 / 10',
    borderBottom: `1px solid ${c.hairline}`,
    backgroundColor: c.surfaceElevated,
  };
});
