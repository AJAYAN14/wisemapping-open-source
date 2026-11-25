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
 * Shared Apple-design tokens & material mixins for the maps workspace.
 * Keeps WiseMapping's warm amber identity while adopting macOS vibrancy,
 * pointer-down tactile feedback, size-aware typography, and accessibility media queries.
 */

export const APPLE_FONT_STACK =
  '"SF Pro Rounded", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang SC", "Hiragino Maru Gothic ProN", "Hiragino Sans GB", Figtree, system-ui, sans-serif';

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
  canvas: isDark ? '#161618' : '#F5F5F7',
  surface: isDark ? '#1F1F23' : '#FFFFFF',
  surfaceElevated: isDark ? '#28282D' : '#FFFFFF',
  sidebarGlass: isDark ? 'rgba(28, 28, 32, 0.86)' : 'rgba(242, 242, 247, 0.84)',
  sidebarSolid: isDark ? '#1C1C20' : '#F2F2F7',
  headerGlass: isDark ? 'rgba(28, 28, 32, 0.78)' : 'rgba(250, 250, 252, 0.78)',
  headerSolid: isDark ? '#1C1C20' : '#FAFAFC',
  textPrimary: isDark ? '#F5F5F7' : '#1D1D1F',
  textSecondary: isDark ? '#A1A1A6' : '#6E6E73',
  textTertiary: isDark ? '#787880' : '#86868B',
  hairline: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.07)',
  hairlineStrong: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
  hoverFill: isDark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(0, 0, 0, 0.04)',
  activeFill: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.07)',
  amber: isDark ? '#FF9F0A' : '#F59E0B',
  amberHover: isDark ? '#FFB340' : '#D97706',
  amberSoft: isDark ? 'rgba(255, 159, 10, 0.16)' : 'rgba(245, 158, 11, 0.12)',
  amberSoftHover: isDark ? 'rgba(255, 159, 10, 0.24)' : 'rgba(245, 158, 11, 0.18)',
  amberText: isDark ? '#FFB340' : '#B45309',
  amberRing: isDark ? 'rgba(255, 159, 10, 0.24)' : 'rgba(245, 158, 11, 0.2)',
  specularEdge: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.7)',
  shadowSubtle: isDark
    ? '0 2px 10px rgba(0, 0, 0, 0.28)'
    : '0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)',
  shadowFloat: isDark
    ? '0 12px 32px rgba(0, 0, 0, 0.45)'
    : '0 8px 28px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
});

export const isDarkTheme = (theme: Theme): boolean => theme.palette.mode === 'dark';

/** Instant tactile press response (Apple Design §1) with reduced-motion fallback (§14). */
export const applePressMixin: CSSObject = {
  transition: 'transform 110ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 140ms ease, opacity 140ms ease',
  '&:active': {
    transform: 'scale(0.97)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'background-color 140ms ease, opacity 140ms ease',
    '&:active': {
      transform: 'none',
    },
  },
};

/** Translucent glass material with reduced-transparency and high-contrast fallbacks (§12, §14). */
export const glassMaterialMixin = (glassBg: string, solidBg: string, blurPx = 20): CSSObject => ({
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
