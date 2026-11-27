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

import type { CSSObject, Theme } from '@mui/material/styles';

/**
 * Unified workspace design tokens & motion mixins for the maps homepage.
 * Enforces a calm neutral canvas (#F5F5F7 / #0D0D10), three strict corner radii,
 * high-contrast charcoal primary CTA, and restrained WiseMapping amber accents.
 */

export const APPLE_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Figtree, system-ui, sans-serif';

/** Unified UI motion curves (Emil Design Engineering: strong ease-out, snappy press). */
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Strict 3-step border-radius scale across the entire workspace. */
export const RADIUS_LG = '12px';
export const RADIUS_MD = '8px';
export const RADIUS_SM = '6px';

export interface AppleColorTokens {
  canvas: string;
  surface: string;
  surfaceElevated: string;
  sidebarGlass: string;
  sidebarSolid: string;
  headerGlass: string;
  headerSolid: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  hairline: string;
  hairlineStrong: string;
  hoverFill: string;
  activeFill: string;
  ctaPrimary: string;
  ctaPrimaryHover: string;
  ctaPrimaryText: string;
  amber: string;
  amberHover: string;
  amberSoft: string;
  amberSoftHover: string;
  amberText: string;
  amberRing: string;
  specularEdge: string;
  shadowSubtle: string;
  shadowFloat: string;
}

export const appleColors = (isDark: boolean): AppleColorTokens => ({
  canvas: isDark ? '#0D0D10' : '#F5F5F7',
  surface: isDark ? '#1A1A1E' : '#FFFFFF',
  surfaceElevated: isDark ? '#242429' : '#F3F4F6',
  sidebarGlass: isDark ? 'rgba(26, 26, 30, 0.90)' : 'rgba(255, 255, 255, 0.92)',
  sidebarSolid: isDark ? '#1A1A1E' : '#FFFFFF',
  headerGlass: isDark ? 'rgba(26, 26, 30, 0.84)' : 'rgba(245, 245, 247, 0.86)',
  headerSolid: isDark ? '#1A1A1E' : '#F5F5F7',
  textPrimary: isDark ? '#F4F4F5' : '#18181B',
  textSecondary: isDark ? '#A1A1AA' : '#71717A',
  textTertiary: isDark ? '#71717A' : '#8E8E95',
  hairline: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(24, 24, 27, 0.08)',
  hairlineStrong: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(24, 24, 27, 0.16)',
  hoverFill: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(24, 24, 27, 0.045)',
  activeFill: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(24, 24, 27, 0.08)',
  ctaPrimary: isDark ? '#F4F4F5' : '#18181B',
  ctaPrimaryHover: isDark ? '#E4E4E7' : '#27272A',
  ctaPrimaryText: isDark ? '#18181B' : '#FFFFFF',
  amber: isDark ? '#FF9F0A' : '#F59E0B',
  amberHover: isDark ? '#FFB340' : '#D97706',
  amberSoft: isDark ? 'rgba(255, 159, 10, 0.16)' : 'rgba(245, 158, 11, 0.11)',
  amberSoftHover: isDark ? 'rgba(255, 159, 10, 0.24)' : 'rgba(245, 158, 11, 0.17)',
  amberText: isDark ? '#FFB340' : '#B45309',
  amberRing: isDark ? 'rgba(255, 159, 10, 0.28)' : 'rgba(217, 119, 6, 0.22)',
  specularEdge: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)',
  shadowSubtle: isDark
    ? '0 1px 3px rgba(0, 0, 0, 0.28)'
    : '0 1px 2px rgba(24, 24, 27, 0.04)',
  shadowFloat: isDark
    ? '0 12px 32px rgba(0, 0, 0, 0.48)'
    : '0 10px 28px rgba(24, 24, 27, 0.10), 0 1px 3px rgba(24, 24, 27, 0.05)',
});

export const isDarkTheme = (theme: Theme): boolean => theme.palette.mode === 'dark';

/** Instant tactile press response with strong ease-out and reduced-motion fallback. */
export const applePressMixin: CSSObject = {
  transition: `transform 140ms ${EASE_OUT}, background-color 140ms ease, border-color 140ms ease, opacity 140ms ease`,
  '&:active': {
    transform: 'scale(0.97)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'background-color 140ms ease, border-color 140ms ease, opacity 140ms ease',
    '&:active': {
      transform: 'none',
    },
  },
};

/** Translucent glass material with reduced-transparency and high-contrast fallbacks. */
export const glassMaterialMixin = (glassBg: string, solidBg: string, blurPx = 18): CSSObject => ({
  backgroundColor: glassBg,
  backdropFilter: `blur(${blurPx}px) saturate(160%)`,
  WebkitBackdropFilter: `blur(${blurPx}px) saturate(160%)`,
  '@media (prefers-reduced-transparency: reduce)': {
    backgroundColor: solidBg,
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
  '@media (prefers-contrast: more)': {
    backgroundColor: solidBg,
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
});
