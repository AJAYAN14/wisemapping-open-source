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

import React, { createContext, use, useState, useEffect, ReactNode, useMemo } from 'react';
import type { PaletteMode } from '@mui/material/styles';
import { readStorage, writeStorage } from '../utils/storage';
import {
  THEME_MODE_CHANGE_EVENT,
  THEME_MODE_STORAGE_KEY,
  ThemeModeChangeDetail,
  dispatchThemeModeChange,
  isValidThemeMode,
  resolveSystemThemeMode,
} from '../utils/themeMode';

interface ThemeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
  initializeThemeFromSystem: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const APP_THEME_SOURCE = 'app-theme-provider';

export const AppThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>(() => {
    // Check localStorage first, then system preference
    const savedMode = readStorage(THEME_MODE_STORAGE_KEY);
    if (isValidThemeMode(savedMode)) {
      return savedMode;
    }

    return resolveSystemThemeMode();
  });

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    writeStorage(THEME_MODE_STORAGE_KEY, newMode);
    dispatchThemeModeChange(newMode, APP_THEME_SOURCE);
  };

  const initializeThemeFromSystem = () => {
    // Only initialize if no preference has been set
    if (!readStorage(THEME_MODE_STORAGE_KEY)) {
      const systemMode = resolveSystemThemeMode();
      setMode(systemMode);
      writeStorage(THEME_MODE_STORAGE_KEY, systemMode);
      dispatchThemeModeChange(systemMode, APP_THEME_SOURCE);
    }
  };

  // One object per mode: a new one on every render re-rendered every consumer with the parent.
  // The functions only read and set what they own, so they are as stable as the mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ mode, toggleMode, initializeThemeFromSystem }), [mode]);

  // Listen for system theme changes and theme switches made by the editor or other tabs
  useEffect(() => {
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : undefined;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set a preference
      if (!readStorage(THEME_MODE_STORAGE_KEY)) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== THEME_MODE_STORAGE_KEY) {
        return;
      }
      if (isValidThemeMode(event.newValue)) {
        setMode(event.newValue);
      } else if (event.newValue === null) {
        setMode(resolveSystemThemeMode());
      }
    };

    const handleThemeModeChange = (event: Event) => {
      const detail = (event as CustomEvent<ThemeModeChangeDetail>).detail;
      if (detail && detail.source !== APP_THEME_SOURCE && isValidThemeMode(detail.mode)) {
        setMode(detail.mode);
      }
    };

    mediaQuery?.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(THEME_MODE_CHANGE_EVENT, handleThemeModeChange);
    return () => {
      mediaQuery?.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(THEME_MODE_CHANGE_EVENT, handleThemeModeChange);
    };
  }, []);

  return <ThemeContext value={value}>{children}</ThemeContext>;
};

export const useOptionalTheme = (): ThemeContextType | undefined => use(ThemeContext);

export const useTheme = (): ThemeContextType => {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within an AppThemeProvider');
  }
  return context;
};
