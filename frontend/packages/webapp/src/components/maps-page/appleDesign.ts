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
 * Clean semantic color tokens & motion mixins aligned with the official HIG color palette:
 * - Light: pure #FFFFFF surfaces on crisp cool-neutral #F2F2F7 grouped canvas, #007AFF primary, rgba(60,60,67,0.6) secondary
 * - Dark: pure #000000 canvas, #1C1C1E / #2C2C2E layered surfaces, #0A84FF primary, rgba(235,235,245,0.6) secondary
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
  canvas: isDark ? '#000000' : '#F2F2F7',
  surface: isDark ? '#1C1C1E' : '#FFFFFF',
  surfaceElevated: isDark ? '#2C2C2E' : '#FFFFFF',
  sidebarGlass: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.94)',
  sidebarSolid: isDark ? '#1C1C1E' : '#FFFFFF',
  headerGlass: isDark ? 'rgba(0, 0, 0, 0.86)' : 'rgba(242, 242, 247, 0.88)',
  headerSolid: isDark ? '#000000' : '#F2F2F7',
  textPrimary: isDark ? '#FFFFFF' : '#000000',
  textSecondary: isDark ? 'rgba(235, 235, 245, 0.60)' : 'rgba(60, 60, 67, 0.60)',
  textTertiary: isDark ? 'rgba(235, 235, 245, 0.36)' : 'rgba(60, 60, 67, 0.36)',
  hairline: isDark ? 'rgba(84, 84, 86, 0.42)' : 'rgba(60, 60, 67, 0.12)',
  hairlineStrong: isDark ? '#38383A' : '#C6C6C8',
  hoverFill: isDark ? 'rgba(120, 120, 128, 0.24)' : 'rgba(120, 120, 128, 0.12)',
  activeFill: isDark ? 'rgba(120, 120, 128, 0.32)' : 'rgba(120, 120, 128, 0.18)',
  ctaPrimary: isDark ? '#0A84FF' : '#007AFF',
  ctaPrimaryHover: isDark ? '#409CFF' : '#0066D6',
  ctaPrimaryText: '#FFFFFF',
  amber: isDark ? '#FF9F0A' : '#FF9500',
  amberHover: isDark ? '#409CFF' : '#007AFF',
  amberSoft: isDark ? 'rgba(10, 132, 255, 0.18)' : 'rgba(0, 122, 255, 0.10)',
  amberSoftHover: isDark ? 'rgba(10, 132, 255, 0.26)' : 'rgba(0, 122, 255, 0.16)',
  amberText: isDark ? '#409CFF' : '#007AFF',
  amberRing: isDark ? 'rgba(10, 132, 255, 0.32)' : 'rgba(0, 122, 255, 0.24)',
  specularEdge: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)',
  shadowSubtle: isDark
    ? '0 1px 2px rgba(0, 0, 0, 0.4)'
    : '0 1px 2px rgba(0, 0, 0, 0.04)',
  shadowFloat: isDark
    ? '0 12px 32px rgba(0, 0, 0, 0.55)'
    : '0 8px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
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
  backdropFilter: `blur(${blurPx}px) saturate(180%)`,
  WebkitBackdropFilter: `blur(${blurPx}px) saturate(180%)`,
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
