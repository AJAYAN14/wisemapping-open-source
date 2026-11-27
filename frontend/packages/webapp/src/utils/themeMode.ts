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

export type ThemeMode = 'light' | 'dark';

export const THEME_MODE_STORAGE_KEY = 'themeMode';
export const THEME_MODE_CHANGE_EVENT = 'wisemapping:theme-mode-change';

export interface ThemeModeChangeDetail {
  mode: ThemeMode;
  source: unknown;
}

export const isValidThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark';

/**
 * Resolves the OS/browser preferred color scheme, defaulting to light when matchMedia is unavailable.
 */
export const resolveSystemThemeMode = (): ThemeMode => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

/**
 * Broadcasts a same-tab theme mode change so AppThemeProvider and ThemeVariantStorage stay in sync.
 */
export const dispatchThemeModeChange = (mode: ThemeMode, source: unknown): void => {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<ThemeModeChangeDetail>(THEME_MODE_CHANGE_EVENT, {
      detail: { mode, source },
    }),
  );
};
