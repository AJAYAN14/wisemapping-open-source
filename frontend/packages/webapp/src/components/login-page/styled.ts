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
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';
import { APPLE_FONT_STACK } from '../maps-page/appleDesign';

/**
 * Apple-style frosted glass floating authentication card (Apple Design §12).
 * Combines translucent vibrancy, specular highlights, and continuous squircle corners.
 */
export const AppleLoginCard = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    position: 'relative',
    width: '100%',
    maxWidth: '400px',
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: '44px 36px 36px',
    borderRadius: '24px',
    textAlign: 'center',
    backgroundColor: isDark ? 'rgba(32, 32, 36, 0.72)' : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(32px) saturate(190%)',
    WebkitBackdropFilter: 'blur(32px) saturate(190%)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)'}`,
    boxShadow: isDark
      ? '0 24px 56px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)'
      : '0 24px 60px -12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
    animation: 'appleCardEnter 420ms cubic-bezier(0.16, 1, 0.3, 1)',
    '@keyframes appleCardEnter': {
      '0%': {
        opacity: 0,
        transform: 'scale(0.96) translateY(14px)',
      },
      '100%': {
        opacity: 1,
        transform: 'scale(1) translateY(0)',
      },
    },
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
    '@media (prefers-reduced-transparency: reduce)': {
      backgroundColor: isDark ? '#1F1F23' : '#FFFFFF',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
    '@media (prefers-contrast: more)': {
      border: isDark ? '2px solid rgba(255, 255, 255, 0.3)' : '2px solid rgba(0, 0, 0, 0.35)',
    },
    [theme.breakpoints.down('sm')]: {
      padding: '36px 24px 28px',
      borderRadius: '20px',
    },
  };
});

/** Brand emblem squircle container anchoring the visual hierarchy. */
export const BrandBadge = styled(Box)(() => ({
  width: '64px',
  height: '64px',
  borderRadius: '18px',
  margin: '0 auto 22px',
  background: 'linear-gradient(145deg, #FFB340 0%, #F59E0B 100%)',
  boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.38), inset 0 1px 1px 0 rgba(255, 255, 255, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  '&:hover': {
    transform: 'scale(1.04)',
  },
}));

/** Apple-style prominent title with tight optical tracking (Apple Design §15). */
export const TitleText = styled(Typography)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    fontFamily: APPLE_FONT_STACK,
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
    color: isDark ? '#F5F5F7' : '#1D1D1F',
    marginBottom: '8px',
  };
});

/** Apple-style secondary description. */
export const SubtitleText = styled(Typography)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    fontFamily: APPLE_FONT_STACK,
    fontSize: '15px',
    fontWeight: 400,
    letterSpacing: '-0.01em',
    color: isDark ? '#A1A1A6' : '#6E6E73',
    lineHeight: 1.4,
    marginBottom: '28px',
  };
});

/** Container for OAuth action buttons. */
export const SocialButtons = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  alignItems: 'center',
}));

/** Discrete personal private edition footnote. */
export const SecurityFootnote = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    fontFamily: APPLE_FONT_STACK,
    fontSize: '12px',
    fontWeight: 400,
    color: isDark ? '#787880' : '#86868B',
    marginTop: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    letterSpacing: '0.01em',
    userSelect: 'none',
  };
});

/** Refined translucent inline error alert banner. */
export const AppleAlert = styled(Alert)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: '14px',
    marginBottom: '20px',
    fontFamily: APPLE_FONT_STACK,
    fontSize: '13px',
    textAlign: 'left',
    backgroundColor: isDark ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 59, 48, 0.08)',
    border: `1px solid ${isDark ? 'rgba(255, 69, 58, 0.3)' : 'rgba(255, 59, 48, 0.2)'}`,
    color: isDark ? '#FF6961' : '#D32F2F',
    '& .MuiAlert-icon': {
      color: isDark ? '#FF6961' : '#D32F2F',
    },
  };
});
