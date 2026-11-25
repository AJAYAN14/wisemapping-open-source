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
import TableContainer from '@mui/material/TableContainer';
import Toolbar from '@mui/material/Toolbar';
import { alpha, styled } from '@mui/material/styles';
import { appleColors, isDarkTheme } from '../appleDesign';

// The loading placeholder of the map page (see MapsListSkeleton).

export const DrawerSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(theme.palette.common.white, 0.1),
  }),
}));

export const LoadingAppBar = styled(AppBar)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    '&&': {
      backgroundColor: c.headerSolid,
      boxShadow: 'none',
      border: 'none',
      borderBottom: `1px solid ${c.hairline}`,
    },
    marginLeft: 240,
    width: 'calc(100% - 240px)',
    '& .MuiToolbar-root': {
      backgroundColor: 'transparent',
      minHeight: '60px',
    },
  };
});

export const LoadingContainer = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: c.canvas,
  };
});

export const LoadingDrawer = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: 240,
    flexShrink: 0,
    backgroundColor: c.sidebarSolid,
    borderRight: `1px solid ${c.hairline}`,
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
  };
});

export const LoadingDrawerFooter = styled('div')(({ theme }) => ({
  marginTop: 'auto',
  paddingTop: theme.spacing(2),
}));

export const LoadingDrawerItem = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

export const LoadingDrawerList = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

export const LoadingDrawerLogo = styled('div')({
  padding: '12px 0 14px 0',
});

export const LoadingMainContent = styled('div')({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
});

/** Beside the drawer. */
export const LoadingSearchToolbar = styled(Toolbar)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 0 18px 0',
  margin: 0,
  boxShadow: 'none',
  backgroundColor: 'transparent',
});

export const LoadingToolbarCenter = styled('div')({
  flex: '1 1 0',
  display: 'flex',
  justifyContent: 'flex-end',
  minWidth: 0,
});

export const LoadingToolbarLeft = styled('div')({
  flex: '1 1 0',
  minWidth: 0,
});

export const LoadingToolbarRight = styled('div')({
  display: 'none',
});

export const SkeletonBlock = styled(Skeleton)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.common.black, 0.08),
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(theme.palette.common.white, 0.1),
  }),
}));

export const SkeletonButton = styled(SkeletonBlock)({
  borderRadius: '12px',
});

/** A placeholder over the drawer's background. */
export const SkeletonText = styled(SkeletonBlock)({
  fontSize: '0.96rem',
});

/** The table's card, as wide as the maps list it stands for. */
export const LoadingListPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: 'transparent',
  maxWidth: '1080px',
  margin: '8px auto 24px auto',
  paddingLeft: '28px',
  paddingRight: '28px',
  [theme.breakpoints.down('sm')]: {
    paddingLeft: '8px',
    paddingRight: '8px',
  },
}));

export const LoadingTableContainer = styled(TableContainer)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    borderRadius: '18px',
    boxShadow: c.shadowSubtle,
    overflow: 'hidden',
  };
});
