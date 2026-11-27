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
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import { styled } from '@mui/material/styles';
import { APPLE_FONT_STACK, appleColors, applePressMixin, isDarkTheme } from '../appleDesign';
import { BodyCell, CompactCardHeader, MapCardRoot } from './shared.styled';

export { BodyCell, CompactCardHeader, MapCardRoot };

// ---------------------------------------------------------------- The list and its toolbar

export const ListRoot = styled('div')({
  width: '100%',
});

export const ListPaper = styled(Paper)(({ theme }) => ({
  maxWidth: 'none',
  width: '100%',
  boxSizing: 'border-box',
  margin: '0 0 8px 0',
  paddingLeft: '28px',
  paddingRight: '28px',
  backgroundColor: 'transparent',
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

export const ListToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '12px',
  padding: 0,
  paddingTop: '4px',
  paddingBottom: '18px',
  minHeight: '52px',
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
  gap: '10px',
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
  gap: '10px',
  minWidth: 0,
});

export const WorkspaceTitle = styled('h1')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    margin: 0,
    fontSize: 'clamp(1.2rem, 1rem + 1vw, 1.55rem)',
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.025em',
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
    padding: '2px 9px',
    borderRadius: '999px',
    fontSize: '0.76rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: c.hoverFill,
    color: c.textSecondary,
    border: `1px solid ${c.hairline}`,
    fontFamily: APPLE_FONT_STACK,
  };
});

export const WorkspaceSegmentedGroup = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px',
    borderRadius: '13px',
    backgroundColor: c.hoverFill,
    border: `1px solid ${c.hairline}`,
    gap: '3px',
    flexShrink: 0,
  };
});

export const WorkspaceSegmentedButton = styled('button', {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ theme, active }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    appearance: 'none',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '6px 13px',
    borderRadius: '10px',
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.94rem',
    fontWeight: active ? 700 : 600,
    letterSpacing: '-0.015em',
    lineHeight: 1.2,
    backgroundColor: active ? c.surface : 'transparent',
    color: active ? c.textPrimary : c.textSecondary,
    boxShadow: active ? c.shadowSubtle : 'none',
    transition: 'background-color 140ms ease, color 140ms ease, box-shadow 140ms ease',
    ...applePressMixin,
    '& svg': {
      fontSize: '18px',
      color: active ? c.amber : c.textTertiary,
      transition: 'color 140ms ease',
    },
    '&:hover': {
      color: c.textPrimary,
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${c.amberRing}`,
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
    borderRadius: '12px',
    backgroundColor: c.hoverFill,
    border: `1px solid ${c.hairline}`,
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.82rem',
    fontWeight: 600,
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
    backgroundColor: dragTarget ? c.amberSoft : active ? c.surface : 'transparent',
    color: dragTarget ? c.amberText : active ? c.textPrimary : c.textSecondary,
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.82rem',
    fontWeight: active ? 700 : 600,
    padding: '4px 9px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    cursor: active ? 'default' : 'pointer',
    boxShadow: active ? c.shadowSubtle : 'none',
    transition: 'background-color 120ms ease, color 120ms ease',
    ...(!active && applePressMixin),
    '&:hover': active
      ? undefined
      : {
          backgroundColor: c.surface,
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
    borderRadius: '12px',
    fontSize: '0.84rem',
    fontWeight: 700,
    fontFamily: APPLE_FONT_STACK,
    padding: '6px 14px',
    backgroundColor: c.surface,
    color: c.textPrimary,
    border: `1px solid ${c.hairlineStrong}`,
    boxShadow: c.shadowSubtle,
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.hoverFill,
    },
  };
});

export const ToolbarRightCluster = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginLeft: 'auto',
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
    borderRadius: '12px',
    backgroundColor: c.surface,
    border: `1px solid ${c.hairline}`,
    boxShadow: c.shadowSubtle,
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
      borderColor: c.amber,
      boxShadow: `0 0 0 3px ${c.amberRing}`,
    },
  };
});

export const SearchIconWrapper = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    paddingLeft: '11px',
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: c.textTertiary,
    '& svg': {
      fontSize: '18px',
    },
  };
});

export const SearchInput = styled(InputBase)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    color: c.textPrimary,
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.86rem',
    fontWeight: 600,
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
    '@container maps-main (inline-size < 680px)': {
      width: '100%',
    },
    '& .MuiInputBase-input': {
      padding: '7px 38px 7px 34px',
      border: 'none',
      width: '21ch',
      transition: 'width 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      '&::placeholder': {
        color: c.textTertiary,
        opacity: 1,
        fontWeight: 500,
      },
      '&:focus': {
        width: '28ch',
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
    right: '8px',
    pointerEvents: 'none',
    padding: '2px 6px',
    borderRadius: '6px',
    fontSize: '10.5px',
    fontWeight: 700,
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
    borderRadius: '12px',
    padding: 0,
    margin: 0,
    boxShadow: c.shadowSubtle,
    fontFamily: APPLE_FONT_STACK,
    '& .MuiTablePagination-toolbar': {
      minHeight: '36px',
      paddingLeft: '14px',
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
      fontWeight: 700,
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
    borderRadius: '14px',
    boxShadow: 'none',
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
    minWidth: 680,
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
    fontWeight: 700,
    color: c.textSecondary,
    borderBottom: `1px solid ${c.hairline}`,
    borderTop: 0,
    borderLeft: 0,
    borderRight: 0,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    fontFamily: APPLE_FONT_STACK,
    padding: '11px 14px',
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
      color: c.amber,
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
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    backgroundColor: c.amberSoft,
    color: c.amberText,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    '& svg': {
      fontSize: '18px',
    },
  };
});

export const FolderGlyphBadge = styled('span')(({ theme }) => {
  const isDark = isDarkTheme(theme);
  const c = appleColors(isDark);
  return {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    backgroundColor: isDark ? 'rgba(255, 159, 10, 0.18)' : 'rgba(245, 158, 11, 0.16)',
    color: c.amber,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    '& svg': {
      fontSize: '19px',
    },
  };
});

export const TitleLink = styled(Link)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontSize: '0.96rem',
    fontWeight: 700,
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
    fontSize: '0.84rem',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: c.textSecondary,
    fontFamily: APPLE_FONT_STACK,
  };
});

/**
 * The star of a map. `&&`: the theme's IconButton gives its icons `color: inherit` through a
 * descendant selector, which a single class would lose to.
 */
export const StarIcon = styled(StarRateRoundedIcon, {
  shouldForwardProp: (prop) => prop !== 'starred',
})<{ starred: boolean }>(({ theme, starred }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    '&&': {
      color: starred ? c.amber : c.textTertiary,
      transition: 'transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1), color 140ms ease',
    },
  };
});

export const ActionIconButton = styled('span')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'inline-flex',
    '& .MuiIconButton-root': {
      borderRadius: '10px',
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
    fontSize: '0.96rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    fontFamily: APPLE_FONT_STACK,
    color: c.textPrimary,
    overflowWrap: 'break-word',
  };
});

// ---------------------------------------------------------------- View Switcher, Sort & Grid View

export const ViewModeGroup = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px',
    borderRadius: '11px',
    backgroundColor: c.hoverFill,
    border: `1px solid ${c.hairline}`,
    gap: '2px',
    flexShrink: 0,
  };
});

export const ViewModeButton = styled('button', {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ theme, active }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    appearance: 'none',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '28px',
    borderRadius: '8px',
    backgroundColor: active ? c.surface : 'transparent',
    color: active ? c.textPrimary : c.textSecondary,
    boxShadow: active ? c.shadowSubtle : 'none',
    transition: 'background-color 140ms ease, color 140ms ease, box-shadow 140ms ease',
    ...applePressMixin,
    '& svg': {
      fontSize: '18px',
    },
    '&:hover': {
      color: c.textPrimary,
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${c.amberRing}`,
    },
  };
});

export const SortTriggerButton = styled(Button)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    minWidth: '36px',
    height: '36px',
    borderRadius: '11px',
    padding: '0 10px',
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: APPLE_FONT_STACK,
    backgroundColor: c.surface,
    color: c.textPrimary,
    border: `1px solid ${c.hairline}`,
    boxShadow: c.shadowSubtle,
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(224px, 1fr))',
  gap: '18px',
  width: '100%',
});

export const GridCardRoot = styled('div', {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    borderRadius: '14px',
    padding: '8px',
    backgroundColor: c.surfaceElevated,
    border: `1px solid ${selected ? c.amber : c.hairline}`,
    boxShadow: selected ? `0 0 0 2px ${c.amberRing}` : 'none',
    overflow: 'hidden',
    transition:
      'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 160ms ease, border-color 160ms ease',
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: c.shadowSubtle,
      borderColor: selected ? c.amber : c.hairlineStrong,
      '& .grid-card-overlay': {
        opacity: 1,
      },
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
      '&:hover': {
        transform: 'none',
      },
    },
  };
});

export const GridCardPreview = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 10',
    overflow: 'hidden',
    borderRadius: '10px',
    border: `1px solid ${c.hairline}`,
    backgroundColor: isDarkTheme(theme) ? '#18181B' : '#FFFFFF',
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
    borderRadius: '9px',
    backgroundColor: isDarkTheme(theme) ? 'rgba(28, 28, 32, 0.82)' : 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(8px)',
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
    borderRadius: '10px',
    backgroundColor: isDarkTheme(theme) ? 'rgba(28, 28, 32, 0.82)' : 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${c.hairline}`,
    opacity: alwaysVisibleStar ? 1 : 0,
    transition: 'opacity 140ms ease',
    '.MuiBox-root:hover &, .grid-card-overlay': {},
    '@media (hover: none), (pointer: coarse)': {
      opacity: 1,
    },
  };
});

export const GridCardBody = styled('div')({
  padding: '10px 6px 4px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: 0,
  flex: 1,
});

export const GridCardTitle = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.92rem',
    fontWeight: 700,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
    color: c.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
});

export const GridCardMeta = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: '2px',
    fontFamily: APPLE_FONT_STACK,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: c.textSecondary,
    minWidth: 0,
  };
});
