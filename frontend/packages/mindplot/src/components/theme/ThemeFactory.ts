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

import type NodeModel from '../model/NodeModel';
import type ThemeType from '../model/ThemeType';
import PrismTheme from './PrismTheme';
import type { ThemeVariant } from './Theme';
import type Theme from './Theme';

const LEGACY_THEME_IDS = new Set([
  'dark-prism',
  'classic',
  'robot',
  'sunrise',
  'ocean',
  'aurora',
  'retro',
]);

class ThemeFactory {
  private static _cache = new Map<string, Theme>();

  static createById(id: ThemeType | string, variant: ThemeVariant): Theme {
    // Only 'prism' remains active; known legacy ids map silently to 'prism'.
    const actualId = id === 'prism' || LEGACY_THEME_IDS.has(id) ? 'prism' : id;

    // Create cache key from actual theme ID and variant
    const cacheKey = `${actualId}-${variant}`;

    // Return cached instance if it exists
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey)!;
    }

    // Create new instance and cache it
    let result: Theme;
    if (actualId === 'prism') {
      result = new PrismTheme(variant);
    } else {
      // The id comes from the map XML without validation, so do not prevent the map from opening.
      // The fallback is cached under the unknown key, so the warning is logged only once.
      console.warn(`Unknown theme '${actualId}', falling back to 'prism'.`);
      result = ThemeFactory.createById('prism', variant);
    }

    // Cache the instance
    this._cache.set(cacheKey, result);
    return result;
  }

  static create(model: NodeModel, variant: ThemeVariant): Theme {
    const mindmap = model.getMindmap();
    const theme = mindmap.getTheme();
    return ThemeFactory.createById(theme, variant);
  }

  /**
   * Clear the theme cache. Useful for testing or memory management.
   */
  static clearCache(): void {
    this._cache.clear();
  }

  /**
   * Get the current cache size. Useful for debugging.
   */
  static getCacheSize(): number {
    return this._cache.size;
  }
}
export default ThemeFactory;
