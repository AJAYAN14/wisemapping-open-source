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

import React from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import InputBase from '@mui/material/InputBase';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import { GoogleIcon } from '../../common/google-symbol';
import {
  APPLE_FONT_STACK,
  EASE_DRAWER,
  EASE_OUT,
  RADIUS_LG,
  RADIUS_MD,
  RADIUS_SM,
  appleColors,
  applePressMixin,
  isDarkTheme,
} from '../appleDesign';
import { BodyCell, CompactCardHeader, MapCardRoot } from './shared.styled';

export { BodyCell, CompactCardHeader, MapCardRoot };

// ---------------------------------------------------------------- The list and its toolbar

export const ListRoot = styled('div')({
  width: '100%',
});

export const ListPaper = styled(Paper)(({ theme }) => ({
  maxWidth: '1440px',
  width: '100%',
  boxSizing: 'border-box',
  margin: '0 auto 8px auto',
  paddingLeft: '24px',
  paddingRight: '24px',
  backgroundColor: 'transparent',
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

export const ListToolbar = styled(Toolbar)(({ theme }) => ({
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

/** Workspace title / contextual bulk actions on the left of the toolbar. */
export const ToolbarActions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: 0,
  '& .MuiButton-root': {
    [theme.breakpoints.down('sm')]: {
      minWidth: 'auto',
      padding: theme.spacing(0.75, 1.25),
      '& .MuiButton-startIcon': {
        margin: 0,
      },
    },
  },
  '& .button-text': {
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
}));

export const WorkspaceHeading = styled('div')({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
  minWidth: 0,
});

export const WorkspaceTitle = styled('h1')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    margin: 0,
    fontSize: 'clamp(1.15rem, 1rem + 0.6vw, 1.35rem)',
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
    color: c.textPrimary,
    fontFamily: APPLE_FONT_STACK,
    overflowWrap: 'break-word',
  };
});

export const CountPill = styled('span')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1px 7px',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: c.hoverFill,
    color: c.textSecondary,
    fontFamily: APPLE_FONT_STACK,
  };
});

export const WorkspaceSegmentedGroup = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    height: '34px',
    boxSizing: 'border-box',
    padding: '3px',
    borderRadius: RADIUS_MD,
    backgroundColor: c.hoverFill,
    border: `1px solid ${c.hairline}`,
    gap: '2px',
    flexShrink: 0,
  };
});

export const SegmentedPillThumb = styled('span', {
  shouldForwardProp: (prop) => prop !== 'animate',
})<{ animate?: boolean }>(({ theme, animate }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'absolute',
    top: '3px',
    bottom: '3px',
    left: 0,
    borderRadius: RADIUS_SM,
    backgroundColor: c.surface,
    boxShadow: c.shadowSubtle,
    pointerEvents: 'none',
    zIndex: 0,
    transition: animate
      ? `transform 220ms ${EASE_DRAWER}, width 220ms ${EASE_DRAWER}`
      : 'none',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  };
});

export const WorkspaceSegmentedButton = styled('button', {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'hasThumb',
})<{ active: boolean; hasThumb?: boolean }>(({ theme, active, hasThumb }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    zIndex: 1,
    appearance: 'none',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '26px',
    padding: '0 10px',
    borderRadius: RADIUS_SM,
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.84rem',
    fontWeight: active ? 600 : 500,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    backgroundColor: !hasThumb && active ? c.surface : 'transparent',
    color: active ? c.textPrimary : c.textSecondary,
    boxShadow: !hasThumb && active ? c.shadowSubtle : 'none',
    transition: `color 140ms ease, transform 140ms ${EASE_OUT}`,
    ...applePressMixin,
    '& .material-symbols-rounded': {
      color: active ? c.amberHover : c.textTertiary,
    },
    '&:hover': {
      color: c.textPrimary,
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${c.amberRing}`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  };
});

export const BreadcrumbBar = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '6px 10px',
    marginBottom: '12px',
    borderRadius: RADIUS_MD,
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.82rem',
    fontWeight: 500,
    color: c.textSecondary,
    [theme.breakpoints.down('sm')]: {
      marginLeft: '12px',
      marginRight: '12px',
    },
  };
});

export const BreadcrumbChip = styled('button', {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'dragTarget',
})<{ active?: boolean; dragTarget?: boolean }>(({ theme, active, dragTarget }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    appearance: 'none',
    border: 'none',
    outline: dragTarget ? `2px dashed ${c.amber}` : 'none',
    outlineOffset: '-2px',
    backgroundColor: dragTarget ? c.amberSoft : active ? c.hoverFill : 'transparent',
    color: dragTarget ? c.amberText : active ? c.textPrimary : c.textSecondary,
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.82rem',
    fontWeight: active ? 600 : 500,
    padding: '4px 8px',
    borderRadius: RADIUS_SM,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    cursor: active ? 'default' : 'pointer',
    transition: 'background-color 120ms ease, color 120ms ease',
    ...(!active && applePressMixin),
    '&:hover': active
      ? undefined
      : {
          backgroundColor: c.hoverFill,
          color: c.textPrimary,
        },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${c.amberRing}`,
    },
  };
});

export const BulkActionButton = styled(Button)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    height: '34px',
    borderRadius: RADIUS_MD,
    fontSize: '0.84rem',
    fontWeight: 500,
    fontFamily: APPLE_FONT_STACK,
    padding: '0 12px',
    backgroundColor: c.surface,
    color: c.textPrimary,
    border: `1px solid ${c.hairline}`,
    boxShadow: 'none',
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.hoverFill,
      borderColor: c.hairlineStrong,
    },
  };
});

export const ToolbarRightCluster = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
  marginLeft: 'auto',
  minWidth: 0,
  maxWidth: '100%',
  [theme.breakpoints.down('sm')]: {
    flexBasis: '100%',
    width: '100%',
    marginLeft: 0,
  },
  '@container maps-main (inline-size < 680px)': {
    flexBasis: '100%',
    width: '100%',
    marginLeft: 0,
  },
}));

export const SearchContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  [theme.breakpoints.down('sm')]: {
    flex: 1,
    width: '100%',
  },
  '@container maps-main (inline-size < 680px)': {
    flex: 1,
    width: '100%',
  },
}));

export const SearchBox = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    height: '34px',
    boxSizing: 'border-box',
    borderRadius: RADIUS_MD,
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    boxShadow: 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
    '@container maps-main (inline-size < 680px)': {
      width: '100%',
    },
    '&:hover': {
      borderColor: c.hairlineStrong,
    },
    '&:focus-within': {
      borderColor: c.amberHover,
      boxShadow: `0 0 0 2px ${c.amberRing}`,
    },
  };
});

export const SearchIconWrapper = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    paddingLeft: '10px',
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: c.textTertiary,
  };
});

export const SearchInput = styled(InputBase)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    color: c.textPrimary,
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.84rem',
    fontWeight: 400,
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
    '@container maps-main (inline-size < 680px)': {
      width: '100%',
    },
    '& .MuiInputBase-input': {
      padding: '5px 52px 5px 32px',
      border: 'none',
      width: '17ch',
      transition: `width 180ms ${EASE_OUT}`,
      '&::placeholder': {
        color: c.textTertiary,
        opacity: 1,
        fontWeight: 400,
      },
      '&:focus': {
        width: '21ch',
      },
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        paddingRight: '14px',
        '&:focus': {
          width: '100%',
        },
      },
      '@container maps-main (inline-size < 680px)': {
        width: '100%',
        paddingRight: '14px',
        '&:focus': {
          width: '100%',
        },
      },
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
      },
    },
  };
});

export const SearchShortcutHint = styled('kbd')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'absolute',
    right: '7px',
    pointerEvents: 'none',
    padding: '2px 5px',
    borderRadius: RADIUS_SM,
    fontSize: '10.5px',
    fontWeight: 500,
    fontFamily: APPLE_FONT_STACK,
    backgroundColor: c.hoverFill,
    color: c.textTertiary,
    border: `1px solid ${c.hairline}`,
    lineHeight: 1.2,
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
    '@media (pointer: coarse)': {
      display: 'none',
    },
  };
});

export const ToolbarEnd = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
});

export const PaginationDesktop = styled('div')({
  display: 'block',
  backgroundColor: 'transparent',
});

/** Below the cards, where the toolbar has no room for it. */
export const PaginationMobile = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  marginTop: theme.spacing(2),
  marginLeft: theme.spacing(2),
  marginRight: theme.spacing(2),
  backgroundColor: 'transparent',
}));

/** Typed as TablePagination: styled() would drop its `component` prop (rendered as a div here). */
export const ListPagination = styled(TablePagination)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: 'auto',
    display: 'inline-flex',
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    borderRadius: RADIUS_MD,
    padding: 0,
    margin: 0,
    boxShadow: 'none',
    fontFamily: APPLE_FONT_STACK,
    '& .MuiTablePagination-toolbar': {
      minHeight: '34px',
      paddingLeft: '12px',
      paddingRight: '6px',
      minWidth: 'auto',
      backgroundColor: 'transparent',
    },
    '& .MuiTablePagination-spacer': {
      display: 'none',
    },
    '& .MuiTablePagination-selectLabel': {
      margin: 0,
    },
    '& .MuiTablePagination-displayedRows': {
      margin: 0,
      fontSize: '0.8rem',
      fontWeight: 500,
      fontVariantNumeric: 'tabular-nums',
      color: c.textSecondary,
    },
    [theme.breakpoints.down('sm')]: {
      width: 'auto',
      overflow: 'hidden',
      marginRight: 0,
    },
  };
}) as typeof TablePagination;

export const ListTableContainer = styled(TableContainer)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    borderRadius: RADIUS_LG,
    boxShadow: c.shadowSubtle,
    overflowX: 'auto',
    overflowY: 'hidden',
    maxWidth: '100%',
    [theme.breakpoints.down('sm')]: {
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
    },
    '@container maps-main (inline-size < 680px)': {
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
    },
  };
});

// ---------------------------------------------------------------- The table (wide screens)

export const ListTable = styled(Table)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    minWidth: 600,
    backgroundColor: c.surface,
    '& tbody tr': {
      background: 'transparent',
      transition: 'background-color 120ms ease',
      cursor: 'pointer',
      '&:last-of-type td': {
        borderBottom: 'none',
      },
      '&:hover': {
        backgroundColor: c.hoverFill,
      },
      '&.Mui-selected': {
        backgroundColor: c.amberSoft,
        '&:hover': {
          backgroundColor: c.amberSoftHover,
        },
      },
    },
  };
});

export const HeaderCell = styled(TableCell)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    backgroundColor: c.surface,
    fontWeight: 600,
    color: c.textSecondary,
    borderBottom: `1px solid ${c.hairline}`,
    borderTop: 0,
    borderLeft: 0,
    borderRight: 0,
    fontSize: '0.78rem',
    letterSpacing: '0',
    fontFamily: APPLE_FONT_STACK,
    padding: '10px 14px',
  };
});

export const LabelsBodyCell = styled(BodyCell)({
  maxWidth: '300px',
  overflow: 'hidden',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

/** Read by screen readers only. */
export const VisuallyHidden = styled('span')({
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  top: 20,
  width: 1,
});

/** The row and "select all" checkboxes. */
export const SelectCheckbox = styled(Checkbox)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    color: c.hairlineStrong,
    ...applePressMixin,
    '@media (pointer: coarse)': {
      padding: '10px',
    },
    '&.Mui-checked, &.MuiCheckbox-indeterminate': {
      color: c.amberHover,
    },
  };
});

export const MapRowTitleWrap = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minWidth: 0,
});

export const MapGlyphBadge = styled('span')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '30px',
    height: '30px',
    borderRadius: RADIUS_MD,
    backgroundColor: c.amberSoft,
    color: c.amberText,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
});

export const FolderGlyphBadge = styled('span')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '30px',
    height: '30px',
    borderRadius: RADIUS_MD,
    backgroundColor: c.amberSoft,
    color: c.amberHover,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
});

export const TitleLink = styled(Link)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    fontFamily: APPLE_FONT_STACK,
    color: c.textPrimary,
    textDecoration: 'none',
    transition: 'color 120ms ease',
    '&:hover': {
      color: c.amberText,
      textDecoration: 'none',
    },
  };
});

export const CellText = styled(Typography)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontSize: '0.82rem',
    fontWeight: 400,
    fontVariantNumeric: 'tabular-nums',
    color: c.textSecondary,
    fontFamily: APPLE_FONT_STACK,
  };
});

/**
 * Star action glyph powered by Google Fonts Material Symbols Rounded (`FILL` transitions 0 -> 1).
 * Preserves `data-testid="StarRateRoundedIcon"` for existing test selectors.
 */
export const StarIcon = ({
  starred,
  fontSize = 'medium',
}: {
  starred: boolean;
  color?: string;
  fontSize?: 'small' | 'medium';
}): React.ReactElement =>
  React.createElement(
    StarIconWrap,
    { starred },
    React.createElement(GoogleIcon, {
      name: 'star',
      filled: starred,
      size: fontSize === 'small' ? 18 : 20,
      testId: 'StarRateRoundedIcon',
    }),
  );

const StarIconWrap = styled('span', {
  shouldForwardProp: (prop) => prop !== 'starred',
})<{ starred: boolean }>(({ theme, starred }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: starred ? c.amber : c.textTertiary,
    transition: `color 140ms ease, transform 140ms ${EASE_OUT}`,
  };
});

export const ActionIconButton = styled('span')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'inline-flex',
    '& .MuiIconButton-root': {
      borderRadius: RADIUS_MD,
      color: c.textTertiary,
      ...applePressMixin,
      '@media (pointer: coarse)': {
        minWidth: '44px',
        minHeight: '44px',
      },
      '&:hover': {
        backgroundColor: c.hoverFill,
        color: c.textPrimary,
      },
    },
  };
});

// ---------------------------------------------------------------- The cards (narrow screens)

export const CardTitle = styled(Typography)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    maxWidth: '100%',
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    fontFamily: APPLE_FONT_STACK,
    color: c.textPrimary,
    overflowWrap: 'break-word',
  };
});

export const CardSelectBox = styled('div')({
  paddingLeft: '4px',
  flexShrink: 0,
});

export const CardLink = styled(Link)({
  flex: 1,
  minWidth: 0,
  display: 'block',
});

export const CardTitleStack = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

export const CardMetaText = styled(Typography)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontSize: '0.75rem',
    fontWeight: 400,
    fontVariantNumeric: 'tabular-nums',
    color: c.textSecondary,
  };
});

// ---------------------------------------------------------------- View Switcher, Sort & Grid View

export const ViewModeGroup = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    height: '34px',
    boxSizing: 'border-box',
    padding: '3px',
    borderRadius: RADIUS_MD,
    backgroundColor: c.hoverFill,
    border: `1px solid ${c.hairline}`,
    gap: '2px',
    flexShrink: 0,
  };
});

export const ViewModeThumb = styled('span', {
  shouldForwardProp: (prop) => prop !== 'activeIndex',
})<{ activeIndex: number }>(({ theme, activeIndex }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '28px',
    height: '26px',
    borderRadius: RADIUS_SM,
    backgroundColor: c.surface,
    boxShadow: c.shadowSubtle,
    pointerEvents: 'none',
    zIndex: 0,
    transform: `translate3d(${activeIndex * 30}px, 0, 0)`,
    transition: `transform 200ms ${EASE_DRAWER}`,
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  };
});

export const ViewModeButton = styled('button', {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ theme, active }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    zIndex: 1,
    appearance: 'none',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '26px',
    borderRadius: RADIUS_SM,
    backgroundColor: 'transparent',
    color: active ? c.textPrimary : c.textSecondary,
    transition: `color 140ms ease, transform 140ms ${EASE_OUT}`,
    ...applePressMixin,
    '&:hover': {
      color: c.textPrimary,
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${c.amberRing}`,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  };
});

/** Instant stage wrapper without translateY slide on frequent tab/view toggles (Emil Design Engineering). */
export const ViewTransitionStage = styled('div')({
  minWidth: 0,
});

export const SortTriggerButton = styled(Button)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    minWidth: '34px',
    height: '34px',
    borderRadius: RADIUS_MD,
    padding: '0 10px',
    fontSize: '0.84rem',
    fontWeight: 500,
    fontFamily: APPLE_FONT_STACK,
    backgroundColor: c.surface,
    color: c.textPrimary,
    border: `1px solid ${c.hairline}`,
    boxShadow: 'none',
    textTransform: 'none',
    flexShrink: 0,
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.hoverFill,
      borderColor: c.hairlineStrong,
    },
    '& .MuiButton-startIcon': {
      marginRight: '4px',
      color: c.textSecondary,
    },
  };
});

export const MapsGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(236px, 1fr))',
  gap: '16px',
  width: '100%',
});

export const GridCardRoot = styled('div', {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: RADIUS_LG,
    padding: 0,
    backgroundColor: c.surface,
    border: `1px solid ${selected ? c.amberHover : c.hairline}`,
    boxShadow: selected ? `0 0 0 2px ${c.amberRing}` : c.shadowSubtle,
    overflow: 'hidden',
    contentVisibility: 'auto',
    containIntrinsicSize: '236px 240px',
    transition: `border-color 140ms ease, box-shadow 140ms ease, transform 140ms ${EASE_OUT}`,
    cursor: 'pointer',
    '@media (hover: hover) and (pointer: fine)': {
      '&:hover': {
        borderColor: selected ? c.amberHover : c.hairlineStrong,
        boxShadow: selected ? `0 0 0 2px ${c.amberRing}` : c.shadowFloat,
        '& .grid-card-overlay': {
          opacity: 1,
        },
      },
    },
    '&:active': {
      transform: 'scale(0.988)',
    },
    '&:focus-within .grid-card-overlay': {
      opacity: 1,
    },
    '@media (hover: none), (pointer: coarse)': {
      '& .grid-card-overlay': {
        opacity: 1,
      },
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:active': {
        transform: 'none',
      },
    },
  };
});

export const GridCardLink = styled(Link)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  color: 'inherit',
  textDecoration: 'none',
});

export const GridCardPreview = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 10',
    overflow: 'hidden',
    borderBottom: `1px solid ${c.hairline}`,
    backgroundColor: c.surfaceElevated,
  };
});

export const GridCardCheckboxOverlay = styled('div', {
  shouldForwardProp: (prop) => prop !== 'visible',
})<{ visible?: boolean }>(({ theme, visible }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'absolute',
    top: '8px',
    left: '8px',
    zIndex: 2,
    borderRadius: RADIUS_MD,
    backgroundColor: isDarkTheme(theme) ? 'rgba(26, 26, 30, 0.88)' : 'rgba(255, 255, 255, 0.92)',
    border: `1px solid ${c.hairline}`,
    opacity: visible ? 1 : 0,
    transition: 'opacity 140ms ease',
    display: 'inline-flex',
    '& .MuiCheckbox-root': {
      padding: '3px',
    },
    '@media (hover: none), (pointer: coarse)': {
      opacity: 1,
    },
  };
});

export const GridCardActionsOverlay = styled('div', {
  shouldForwardProp: (prop) => prop !== 'alwaysVisibleStar',
})<{ alwaysVisibleStar?: boolean }>(({ theme, alwaysVisibleStar }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: '2px',
    borderRadius: RADIUS_MD,
    backgroundColor: isDarkTheme(theme) ? 'rgba(26, 26, 30, 0.88)' : 'rgba(255, 255, 255, 0.92)',
    border: `1px solid ${c.hairline}`,
    opacity: alwaysVisibleStar ? 1 : 0,
    transition: 'opacity 140ms ease',
    '@media (hover: none), (pointer: coarse)': {
      opacity: 1,
    },
  };
});

export const GridCardBody = styled('div')({
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  minWidth: 0,
  flex: 1,
});

export const GridCardTitle = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.88rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
    color: c.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
});

export const GridCardFolderSlot = styled('div')({
  minHeight: '16px',
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
});

export const GridCardMeta = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: 'auto',
    paddingTop: '2px',
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.75rem',
    fontWeight: 400,
    color: c.textSecondary,
    minWidth: 0,
  };
});

export const GridMetaTime = styled('span')({
  fontSize: 'inherit',
  fontWeight: 'inherit',
  color: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const GridMetaSize = styled('span')({
  fontSize: 'inherit',
  fontWeight: 500,
  color: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
});
