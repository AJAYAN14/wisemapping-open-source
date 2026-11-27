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
import Skeleton from '@mui/material/Skeleton';
import { getFrostedGlassBar, getFrostedGlassDock } from '../../theme/appleDesign';
import { EDITOR_LAYOUT, EDITOR_Z_INDEX } from '../../theme/layout';

export const LoadingContainer = styled('div')(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    position: 'absolute',
    inset: 0,
    backgroundColor: isDark ? '#000000' : '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    zIndex: EDITOR_Z_INDEX.canvasChrome,
    overflow: 'hidden',
  };
});

export const AppBarSkeleton = styled('header')(({ theme }) => ({
  ...getFrostedGlassBar(theme),
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1,
  paddingTop: 'env(safe-area-inset-top, 0px)',
}));

export const AppBarToolbar = styled('div')(({ theme }) => ({
  minHeight: '3rem',
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
  [theme.breakpoints.up('sm')]: {
    paddingLeft: 'max(14px, env(safe-area-inset-left, 0px))',
    paddingRight: 'max(14px, env(safe-area-inset-right, 0px))',
    gap: '4px',
  },
}));

export const AppBarLeft = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  minWidth: 0,
  [theme.breakpoints.up('sm')]: {
    gap: '6px',
  },
}));

export const AppBarRight = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  flexShrink: 0,
  [theme.breakpoints.up('sm')]: {
    gap: '4px',
  },
}));

export const AppBarDivider = styled('span')(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    width: '1px',
    height: '16px',
    marginInline: '4px',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
    flexShrink: 0,
    [theme.breakpoints.up('sm')]: {
      marginInline: '6px',
    },
  };
});

export const DesktopOnlyGroup = styled('div')(({ theme }) => ({
  display: 'none',
  alignItems: 'center',
  gap: '4px',
  [theme.breakpoints.up('md')]: {
    display: 'flex',
  },
}));

export const CompactOnlyGroup = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
}));

export const SkeletonBlock = styled(Skeleton)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.11)' : 'rgba(0, 0, 0, 0.08)',
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      '&::after': {
        animation: 'none',
      },
    },
  };
});

export const AppBarIconSkeleton = styled(SkeletonBlock)(({ theme }) => ({
  width: 34,
  height: 34,
  borderRadius: '10px',
  flexShrink: 0,
  [theme.breakpoints.up('sm')]: {
    width: 36,
    height: 36,
  },
}));

export const AppBarLogoSkeleton = styled(SkeletonBlock)(({ theme }) => ({
  display: 'none',
  width: 108,
  height: 22,
  borderRadius: '6px',
  marginLeft: theme.spacing(0.5),
  marginRight: theme.spacing(0.25),
  flexShrink: 0,
  [theme.breakpoints.up('sm')]: {
    display: 'block',
  },
}));

export const AppBarTitleSkeleton = styled(SkeletonBlock)(({ theme }) => ({
  width: 96,
  height: 30,
  borderRadius: '10px',
  marginLeft: theme.spacing(0.25),
  [theme.breakpoints.up('sm')]: {
    width: 168,
    marginLeft: theme.spacing(0.75),
  },
}));

export const CanvasSkeleton = styled('div')({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
});

export const MindmapStage = styled('div')({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const ConnectorsSvg = styled('svg')(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  overflow: 'visible',
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

export const CentralNodeSkeleton = styled(SkeletonBlock)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    position: 'relative',
    zIndex: 1,
    width: 152,
    height: 46,
    borderRadius: '14px',
    backgroundColor: isDark ? 'rgba(10, 132, 255, 0.24)' : 'rgba(0, 122, 255, 0.14)',
    border: `1.5px solid ${isDark ? 'rgba(64, 156, 255, 0.35)' : 'rgba(0, 122, 255, 0.25)'}`,
    [theme.breakpoints.up('sm')]: {
      width: 184,
      height: 54,
    },
  };
});

export const BranchSide = styled('div')(({ theme }) => ({
  display: 'none',
  flexDirection: 'column',
  gap: '28px',
  position: 'relative',
  zIndex: 1,
  [theme.breakpoints.up('sm')]: {
    display: 'flex',
  },
}));

export const BranchGroup = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: '28px',
});

export const SubNodesColumn = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
});

export const MainNodeSkeleton = styled(SkeletonBlock)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    height: 36,
    borderRadius: '12px',
    backgroundColor: isDark ? 'rgba(44, 44, 46, 0.9)' : 'rgba(255, 255, 255, 0.92)',
    border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)'}`,
  };
});

export const SubNodeSkeleton = styled(SkeletonBlock)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    height: 26,
    borderRadius: '10px',
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.85)' : 'rgba(255, 255, 255, 0.78)',
    border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.07)'}`,
  };
});

export const ZoomToolbarSkeleton = styled('div')(({ theme }) => ({
  ...getFrostedGlassDock(theme),
  position: 'absolute',
  top: 'auto',
  left: 'auto',
  right: `max(${EDITOR_LAYOUT.zoomToolbar.rightCompact}, env(safe-area-inset-right, 0px))`,
  bottom: EDITOR_LAYOUT.zoomToolbar.bottom,
  maxWidth:
    'calc(100dvw - 60px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '4px 6px',
  zIndex: EDITOR_Z_INDEX.canvasChrome,
  [theme.breakpoints.down('sm')]: {
    left: 0,
    right: 0,
    marginInline: 'auto',
    width: 'fit-content',
    maxWidth:
      'calc(100dvw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))',
    transform: 'none',
  },
}));

export const DockButtonSkeleton = styled(SkeletonBlock)({
  width: 32,
  height: 32,
  borderRadius: '50%',
  flexShrink: 0,
});

export const DockZoomPillSkeleton = styled(SkeletonBlock)({
  width: 46,
  height: 26,
  marginInline: '2px',
  borderRadius: '9999px',
  flexShrink: 0,
});

export const DockDivider = styled('span')(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    width: '1px',
    height: '18px',
    marginInline: '3px',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
    flexShrink: 0,
  };
});
