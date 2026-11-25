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

import { Theme } from '@mui/material/styles';

/**
 * Apple Design system tokens and mixins for the WiseMapping mindmap editor.
 * Derived from Apple's HIG & WWDC Designing Fluid Interfaces guidelines:
 * - Frosted vibrancy & translucent materials (backdrop-filter: blur(...) saturate(180%))
 * - Physical tactile feedback (applePressMixin scale on pointer down)
 * - Optical typography & tabular figures for numbers
 * - Graceful fallbacks for reduced-motion and reduced-transparency
 */

export const appleFontStack = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"SF Pro Rounded"',
  '"SF Pro Text"',
  'system-ui',
  '"Segoe UI"',
  'Roboto',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  'sans-serif',
].join(', ');

export const applePressMixin = {
  transition: 'transform 160ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms ease, box-shadow 150ms ease',
  '@media (hover: hover)': {
    '&:hover': {
      transform: 'translateY(-0.5px)',
    },
  },
  '&:active': {
    transform: 'scale(0.92) !important',
    transition: 'transform 100ms cubic-bezier(0.2, 0, 0, 1)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none !important',
    transform: 'none !important',
    '&:active': {
      transform: 'none !important',
    },
  },
};

export const getFrostedGlassBar = (theme: Theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.78)' : 'rgba(255, 255, 255, 0.78)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    boxShadow: isDark
      ? '0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
      : '0 1px 3px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
    color: theme.palette.text.primary,
    '@media (prefers-reduced-transparency: reduce)': {
      backgroundColor: theme.palette.background.paper,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
};

export const getFrostedGlassCard = (theme: Theme, radius = '16px') => {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark ? 'rgba(32, 32, 36, 0.82)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    borderRadius: radius,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
    boxShadow: isDark
      ? '0 12px 36px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      : '0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    color: theme.palette.text.primary,
    '@media (prefers-reduced-transparency: reduce)': {
      backgroundColor: theme.palette.background.paper,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
};

export const getFrostedGlassDock = (theme: Theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark ? 'rgba(30, 30, 34, 0.85)' : 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    borderRadius: '9999px',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)'}`,
    boxShadow: isDark
      ? '0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
      : '0 10px 30px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    color: theme.palette.text.primary,
    '@media (prefers-reduced-transparency: reduce)': {
      backgroundColor: theme.palette.background.paper,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  };
};
