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

import type { ThemeVariant } from '@wisemapping/mindplot';
import { ThemeVariantStorage } from '@wisemapping/editor';
import { appLogger as log } from '../utils/logger';
import {
  THEME_MODE_CHANGE_EVENT,
  THEME_MODE_STORAGE_KEY,
  ThemeModeChangeDetail,
  dispatchThemeModeChange,
  isValidThemeMode,
  resolveSystemThemeMode,
} from '../utils/themeMode';

/**
 * LocalStorage implementation of ThemeVariantStorage.
 * This class handles theme variant persistence using browser's localStorage.
 */
export class LocalStorageThemeVariantStorage implements ThemeVariantStorage {
  private readonly listeners: Set<(variant: ThemeVariant) => void> = new Set();
  // Bound once, so destroy() removes the same functions the constructor added.
  private readonly storageListener = this.handleStorageChange.bind(this);
  private readonly themeChangeListener = this.handleThemeModeChange.bind(this);

  constructor() {
    // Listen for storage changes from other tabs/windows and same-tab AppThemeProvider switches
    window.addEventListener('storage', this.storageListener);
    window.addEventListener(THEME_MODE_CHANGE_EVENT, this.themeChangeListener);
  }

  getThemeVariant(): ThemeVariant {
    try {
      const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
      if (isValidThemeMode(stored)) {
        return stored;
      }
    } catch (error) {
      log.warn('Failed to read theme variant from localStorage:', error);
    }
    return resolveSystemThemeMode();
  }

  setThemeVariant(variant: ThemeVariant): void {
    try {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, variant);
      // Notify all subscribers and sync AppThemeProvider in the same tab
      this.listeners.forEach((callback) => callback(variant));
      dispatchThemeModeChange(variant, this);
    } catch (error) {
      log.warn('Failed to save theme variant to localStorage:', error);
    }
  }

  subscribe(callback: (variant: ThemeVariant) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  private handleStorageChange(event: StorageEvent): void {
    if (event.key === THEME_MODE_STORAGE_KEY && isValidThemeMode(event.newValue)) {
      const variant = event.newValue;
      this.listeners.forEach((callback) => callback(variant));
    }
  }

  private handleThemeModeChange(event: Event): void {
    const detail = (event as CustomEvent<ThemeModeChangeDetail>).detail;
    if (detail && detail.source !== this && isValidThemeMode(detail.mode)) {
      const variant = detail.mode;
      this.listeners.forEach((callback) => callback(variant));
    }
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    window.removeEventListener('storage', this.storageListener);
    window.removeEventListener(THEME_MODE_CHANGE_EVENT, this.themeChangeListener);
    this.listeners.clear();
  }
}

export default LocalStorageThemeVariantStorage;
