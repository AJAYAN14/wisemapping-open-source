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
import { $assert } from './util/assert';
import { AjaxUtils } from './util/AjaxUtils';
import PersistenceManager, { type SaveEvents, type SaveOptions } from './PersistenceManager';

class MockPersistenceManager extends PersistenceManager {
  private exampleMap: string;

  constructor(exampleMapAsXml: string) {
    super();
    $assert(exampleMapAsXml, 'The test map must be set');
    this.exampleMap = exampleMapAsXml;
  }

  saveMapXml(
    mapId: string,
    mapXml: Document,
    _pref?: string,
    _saveHistory?: boolean,
    events?: SaveEvents,
    _options?: SaveOptions,
  ): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const xmlStr = new XMLSerializer().serializeToString(mapXml);
        window.localStorage.setItem(`wisemapping.mock.xml.${mapId}`, xmlStr);
        window.localStorage.setItem(`mock-map-${mapId}-xml`, xmlStr);
      }
    } catch (e) {
      console.warn('Failed to save mock map to localStorage:', e);
    }
    events?.onSuccess();
  }

  discardChanges(mapId?: string) {
    try {
      if (typeof window !== 'undefined' && window.localStorage && mapId) {
        window.localStorage.removeItem(`wisemapping.mock.xml.${mapId}`);
        window.localStorage.removeItem(`mock-map-${mapId}-xml`);
      }
    } catch (e) {
      console.warn(e);
    }
  }

  loadMapDom(mapId: string): Promise<Document> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved =
          window.localStorage.getItem(`wisemapping.mock.xml.${mapId}`) ||
          window.localStorage.getItem(`mock-map-${mapId}-xml`);
        if (saved && saved.includes('<map') && saved.includes('<topic')) {
          return Promise.resolve(AjaxUtils.parseXML(saved));
        }
      }
    } catch (e) {
      console.warn('Failed to load mock map from localStorage:', e);
    }
    return Promise.resolve(AjaxUtils.parseXML(this.exampleMap));
  }

  unlockMap(): void {
    // Ignore, no implementation required ...
  }
}

export default MockPersistenceManager;
