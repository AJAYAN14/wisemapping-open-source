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
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogContent from '@mui/material/DialogContent';
import Paper from '@mui/material/Paper';

export const OutlineContainer = styled(Box)(({ theme }) => ({
  padding: '56px 16px 76px 16px',
  maxHeight: '100%',
  height: '100%',
  overflow: 'auto',
  fontFamily: 'Figtree, Segoe UI, Helvetica, Arial, sans-serif',
  fontSize: '0.875rem',
  lineHeight: 1.6,
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  position: 'relative',
  [theme.breakpoints.up('sm')]: {
    padding: '64px 48px 76px 48px',
  },
  [theme.breakpoints.up('md')]: {
    padding: '79px 118px 10px 118px',
  },
}));

export const OutlineNode = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'level' && prop !== 'interactive',
})<{ level: number; interactive?: boolean }>(({ theme, level, interactive }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: `${theme.spacing(0.5)} 0`,
  paddingLeft: theme.spacing(level * 2),
  position: 'relative',
  borderRadius: interactive ? '6px' : undefined,
  cursor: interactive ? 'pointer' : undefined,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const ExpandButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(0.25),
  marginRight: theme.spacing(0.5),
  width: '24px',
  height: '24px',
  position: 'relative',
  '& .MuiSvgIcon-root': {
    fontSize: '16px',
  },
  '@media (pointer: coarse)': {
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '-10px',
    },
  },
}));

export const NodeIcon = styled('img')({
  width: '16px',
  height: '16px',
  display: 'inline-block',
  verticalAlign: 'middle',
});

export const FeatureIcon = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  padding: theme.spacing(0.5),
  cursor: 'pointer',
  position: 'relative',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  borderRadius: '4px',
  border: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.secondary,
  '@media (pointer: coarse)': {
    minWidth: '36px',
    minHeight: '36px',
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '-4px',
    },
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    transform: 'translateY(-1px)',
    borderColor: theme.palette.text.secondary,
    color: theme.palette.text.primary,
  },
  '& .MuiSvgIcon-root': {
    fontSize: '18px',
  },
}));

export const NodeText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'level',
})<{ level: number }>(({ theme, level }) => ({
  fontWeight: level === 0 ? 600 : 400,
  display: 'inline',
  fontFamily: 'Figtree, Segoe UI, Helvetica, Arial, sans-serif',
  fontSize: level === 0 ? '17px' : level === 1 ? '17px' : '15px',
  color: theme.palette.text.primary,
  lineHeight: 1.4,
}));

export const NodeTextButton = styled('button', {
  shouldForwardProp: (prop) => prop !== 'level',
})<{ level: number }>(({ theme, level }) => ({
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  minHeight: '24px',
  borderRadius: '4px',
  cursor: 'pointer',
  textAlign: 'left',
  fontWeight: level === 0 ? 600 : 400,
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: 'Figtree, Segoe UI, Helvetica, Arial, sans-serif',
  fontSize: level === 0 ? '17px' : level === 1 ? '17px' : '15px',
  color: theme.palette.text.primary,
  lineHeight: 1.4,
  '&:hover': {
    color: theme.palette.primary.main,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

export const CentralTitleButton = styled('button')(({ theme }) => ({
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  borderRadius: '6px',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  '&:hover': {
    color: theme.palette.primary.main,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

export const VerticalLine = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'level' && prop !== 'hasChildren',
})<{ level: number; hasChildren: boolean }>(({ theme, level, hasChildren }) => ({
  position: 'absolute',
  left: theme.spacing(level * 2 + 0.5),
  top: hasChildren ? '20px' : '10px',
  bottom: hasChildren ? '0' : '10px',
  width: '1px',
  borderLeft: `1px dashed ${theme.palette.divider}`,
  pointerEvents: 'none',
}));

export const FloatingToolbar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(3),
  left: theme.spacing(3),
  display: 'flex',
  gap: theme.spacing(0.5),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: '12px',
  padding: theme.spacing(1),
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(8px)',
  zIndex: 1000,
  animation: 'fadeIn 0.25s ease-out',
  '@keyframes fadeIn': {
    '0%': { opacity: 0, transform: 'translateY(10px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' },
  },
}));

export const NodeWrapper = styled(Box)({
  position: 'relative',
});

export const ExpandPlaceholder = styled(Box)({
  width: '28px',
  marginRight: '4px',
});

export const IconContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  marginRight: '4px',
});

export const FeatureIconContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  marginLeft: 'auto',
  justifyContent: 'flex-end',
});

export const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(1.5),
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  [theme.breakpoints.up('sm')]: {
    padding: '26px',
  },
}));

export const CloseButton = styled(IconButton)({
  position: 'absolute',
  top: 'max(16px, env(safe-area-inset-top, 0px))',
  right: 'max(16px, env(safe-area-inset-right, 0px))',
  zIndex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.04)',
  '@media (pointer: coarse)': {
    minWidth: '44px',
    minHeight: '44px',
  },
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
});

export const OutlineContentWrapper = styled(Box)({});

export const CentralTopicTitle = styled(Typography)(({ theme }) => ({
  fontFamily: 'Figtree, Segoe UI, Helvetica, Arial, sans-serif',
  fontSize: '28px',
  fontWeight: 600,
  marginBottom: theme.spacing(3),
  color: theme.palette.text.primary,
  textAlign: 'left',
  marginLeft: 0,
  paddingLeft: 28, // Align with the first character of outline text (18px from wrapper + 10px for expand button space)
}));

export const EmptyMessage = styled(Typography)(({ theme }) => ({
  textAlign: 'center',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

export const ToolbarButton = styled(IconButton)(({ theme }) => ({
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const TooltipContent = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : '#ffffff',
  padding: '20px 20px 12px 20px',
  wordWrap: 'break-word',
  textAlign: 'left',
  fontSize: '14px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  lineHeight: 1.6,
  whiteSpace: 'pre-line',
  color: theme.palette.text.primary,
  borderRadius: '12px 12px 0 0',
}));

export const TooltipTitle = styled(Typography)(({ theme }) => ({
  backgroundColor: 'transparent',
  fontSize: '10px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  textTransform: 'uppercase',
  padding: '6px 16px 8px 16px',
  textAlign: 'right',
  fontWeight: 500,
  letterSpacing: '0.8px',
  color: theme.palette.text.secondary,
  borderTop: `1px solid ${theme.palette.divider}`,
  marginTop: '8px',
  opacity: 0.8,
}));

export const TooltipLink = styled('a')(({ theme }) => ({
  display: 'inline-block',
  padding: '10px 14px',
  margin: '6px 0',
  background:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, #3a3a00 0%, #4a4a00 100%)'
      : 'linear-gradient(135deg, #fff8f0 0%, #fef5e7 100%)',
  border: '1px solid #ffa800',
  borderRadius: '8px',
  fontSize: '13px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  textDecoration: 'none',
  color: '#ffa800',
  wordBreak: 'break-all',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 2px 4px rgba(255, 168, 0, 0.1)',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    background: 'linear-gradient(135deg, #ffa800 0%, #e57500 100%)',
    color: '#ffffff',
    borderColor: '#e57500',
    textDecoration: 'none',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(255, 168, 0, 0.3)',
  },
}));

export const StyledDialogPaper = styled(Paper)(({ theme }) => ({
  margin: '12.5dvh 12.5dvw',
  height: '75dvh',
  width: '75dvw',
  maxWidth: 'none',
  maxHeight: 'none',
  borderRadius: '12px',
  overflow: 'hidden',
  zIndex: theme.zIndex.modal + 1,
  [theme.breakpoints.down('md')]: {
    margin: '16px',
    width: 'calc(100dvw - 32px)',
    height: '85dvh',
  },
  [theme.breakpoints.down('sm')]: {
    margin: 0,
    width: '100dvw',
    height: '100dvh',
    borderRadius: 0,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
}));

// Style object for Popover paper (used with sx prop as Popover doesn't support PaperComponent)
export const popoverPaperStyles = {
  backgroundColor: 'transparent',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
  borderRadius: '12px',
  border: '1px solid',
  borderColor: 'divider',
  backdropFilter: 'blur(8px)',
  minWidth: 'min(300px, calc(100dvw - 32px))',
  maxWidth: 'min(450px, calc(100dvw - 32px))',
  overflow: 'hidden',
};
