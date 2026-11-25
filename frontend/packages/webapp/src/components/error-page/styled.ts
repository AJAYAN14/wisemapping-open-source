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
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';

/** Ambient full-viewport canvas with subtle amber glow */
export const ErrorCanvas = styled('div')(({ theme }) => ({
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  background:
    theme.palette.mode === 'dark'
      ? 'radial-gradient(ellipse 900px 600px at 50% 25%, rgba(245, 158, 11, 0.08), transparent 75%), #121214'
      : 'radial-gradient(ellipse 900px 600px at 50% 25%, rgba(245, 158, 11, 0.06), transparent 75%), #F8FAFC',
}));

export const ErrorBody = styled('main')(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(3),
  paddingInline: `max(${theme.spacing(3)}, env(safe-area-inset-left, 0px))`,
  width: '100%',
}));

/** The message and its actions, centred in a frosted glass card (Apple Design). */
export const ErrorContent = styled(Box)(({ theme }) => ({
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  padding: theme.spacing(4, 3.5),
  textAlign: 'center',
  borderRadius: '24px',
  backdropFilter: 'blur(32px) saturate(190%)',
  WebkitBackdropFilter: 'blur(32px) saturate(190%)',
  backgroundColor:
    theme.palette.mode === 'dark' ? 'rgba(32, 32, 36, 0.75)' : 'rgba(255, 255, 255, 0.78)',
  border: `1px solid ${
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
  }`,
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 24px 64px -12px rgba(0, 0, 0, 0.6), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)'
      : '0 20px 48px -12px rgba(0, 0, 0, 0.12), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  animation: 'appleCardEnter 420ms cubic-bezier(0.16, 1, 0.3, 1)',
  '@keyframes appleCardEnter': {
    from: {
      opacity: 0,
      transform: 'scale(0.96) translateY(12px)',
    },
    to: {
      opacity: 1,
      transform: 'scale(1) translateY(0)',
    },
  },
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(5, 4.5),
  },
}));

/** Amber squircle emblem badge anchoring the error state */
export const ErrorBadge = styled('div')(({ theme }) => ({
  width: 64,
  height: 64,
  margin: '0 auto 20px auto',
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #FFB340 0%, #F59E0B 100%)',
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 12px 28px -4px rgba(245, 158, 11, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)'
      : '0 10px 24px -4px rgba(245, 158, 11, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.45)',
  color: '#FFFFFF',
}));

export const ApplePrimaryButton = styled(Button)(() => ({
  borderRadius: 14,
  fontWeight: 600,
  fontSize: '0.95rem',
  textTransform: 'none',
  padding: '10px 24px',
  boxShadow: 'none',
  background: 'linear-gradient(135deg, #FFB340 0%, #F59E0B 100%)',
  color: '#FFFFFF',
  transition: 'transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 160ms ease',
  '&:hover': {
    background: 'linear-gradient(135deg, #FFA726 0%, #E65100 100%)',
    boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.35)',
  },
  '&:active': {
    transform: 'scale(0.97)',
  },
}));

export const AppleSecondaryButton = styled(Button)(({ theme }) => ({
  borderRadius: 14,
  fontWeight: 600,
  fontSize: '0.95rem',
  textTransform: 'none',
  padding: '10px 24px',
  borderWidth: '1.5px',
  borderStyle: 'solid',
  borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
  color: theme.palette.text.primary,
  transition: 'transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 160ms ease',
  '&:hover': {
    borderWidth: '1.5px',
    backgroundColor:
      theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
  },
  '&:active': {
    transform: 'scale(0.97)',
  },
}));
