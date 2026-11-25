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
import { $msg } from './Messages';
import { AjaxUtils } from './util/AjaxUtils';
import PersistenceManager, { type SaveEvents, type SaveOptions } from './PersistenceManager';

export type MockPersistenceOptions = {
  hid?: number;
  editorName?: string;
};

type MockHistoryEntry = {
  id: number;
  xml: string;
  lastModificationBy: string;
  lastModificationTime: string;
};

type StoredMapSummary = {
  id: number | string;
  lastModificationBy?: string | undefined;
  lastModificationTime?: string | undefined;
  [key: string]: unknown;
};

const MOCK_MAPS_KEY = 'wisemapping.mock.maps';
const MOCK_SEQ_KEY = 'wisemapping.mock.seq';
const MOCK_XML_PREFIX = 'wisemapping.mock.xml.';
const MOCK_PROPS_PREFIX = 'wisemapping.mock.props.';
const MOCK_HISTORY_PREFIX = 'wisemapping.mock.history.';
const LEGACY_XML_KEY = (mapId: string): string => `mock-map-${mapId}-xml`;

const getStorage = (): Storage | undefined => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors
  }
  return undefined;
};

const readJsonArray = <T>(storage: Storage, key: string): T[] => {
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    }
  } catch {
    // Ignore malformed JSON in storage
  }
  return [];
};

const nextMockSeq = (storage: Storage, minFloor = 0): number => {
  const raw = storage.getItem(MOCK_SEQ_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  const current = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
  const next = Math.max(current, minFloor) + 1;
  storage.setItem(MOCK_SEQ_KEY, String(next));
  return next;
};

class MockPersistenceManager extends PersistenceManager {
  private exampleMap: string;
  private hid: number | undefined;
  private editorName: string | undefined;

  constructor(exampleMapAsXml: string, options?: MockPersistenceOptions) {
    super();
    $assert(exampleMapAsXml, 'The test map must be set');
    this.exampleMap = exampleMapAsXml;
    this.hid = options?.hid;
    this.editorName = options?.editorName;
  }

  private updateMapModification(storage: Storage, mapId: string, now: string): string | undefined {
    const maps = readJsonArray<StoredMapSummary>(storage, MOCK_MAPS_KEY);
    const index = maps.findIndex((m) => String(m.id) === String(mapId));
    const current = index !== -1 ? maps[index] : undefined;
    if (!current) {
      return undefined;
    }
    const modifier = this.editorName || current.lastModificationBy;
    maps[index] = {
      ...current,
      lastModificationTime: now,
      ...(modifier !== undefined ? { lastModificationBy: modifier } : {}),
    };
    storage.setItem(MOCK_MAPS_KEY, JSON.stringify(maps));
    return modifier;
  }

  saveMapXml(
    mapId: string,
    mapXml: Document,
    pref?: string,
    saveHistory?: boolean,
    events?: SaveEvents,
    _options?: SaveOptions,
  ): void {
    if (this.hid !== undefined) {
      events?.onSuccess();
      return;
    }

    const storage = getStorage();
    if (!storage) {
      events?.onSuccess();
      return;
    }

    try {
      const xmlStr = new XMLSerializer().serializeToString(mapXml);
      const now = new Date().toISOString();

      storage.setItem(`${MOCK_XML_PREFIX}${mapId}`, xmlStr);
      storage.removeItem(LEGACY_XML_KEY(mapId));

      if (pref !== undefined) {
        storage.setItem(`${MOCK_PROPS_PREFIX}${mapId}`, pref);
      }

      const mapModifier = this.updateMapModification(storage, mapId, now);

      if (saveHistory === true) {
        const historyKey = `${MOCK_HISTORY_PREFIX}${mapId}`;
        const history = readJsonArray<MockHistoryEntry>(storage, historyKey);
        const maxExistingId = history.reduce(
          (max, entry) => (Number.isInteger(entry.id) && entry.id > max ? entry.id : max),
          0,
        );
        const snapshotId = nextMockSeq(storage, maxExistingId);
        const entry: MockHistoryEntry = {
          id: snapshotId,
          xml: xmlStr,
          lastModificationBy: this.editorName || mapModifier || 'Local User',
          lastModificationTime: now,
        };
        storage.setItem(historyKey, JSON.stringify([entry, ...history]));
      }
      events?.onSuccess();
    } catch (e) {
      console.warn('Failed to save mock map to localStorage:', e);
      events?.onError({
        severity: 'SEVERE',
        errorType: 'unexpected',
        message: $msg('SAVE_COULD_NOT_BE_COMPLETED'),
      });
    }
  }

  discardChanges(mapId?: string): void {
    if (this.hid !== undefined || !mapId) {
      return;
    }
    const storage = getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(LEGACY_XML_KEY(mapId));
      const history = readJsonArray<MockHistoryEntry>(storage, `${MOCK_HISTORY_PREFIX}${mapId}`);
      const latest = history[0];
      if (!latest?.xml) {
        return;
      }
      storage.setItem(`${MOCK_XML_PREFIX}${mapId}`, latest.xml);
      this.updateMapModification(storage, mapId, new Date().toISOString());
    } catch (e) {
      console.warn(e);
    }
  }

  loadMapDom(mapId: string): Promise<Document> {
    const storage = getStorage();

    if (this.hid !== undefined) {
      if (!storage) {
        return Promise.reject(
          new Error(`History entry ${this.hid} could not be found for map ${mapId}`),
        );
      }
      const history = readJsonArray<MockHistoryEntry>(storage, `${MOCK_HISTORY_PREFIX}${mapId}`);
      const entry = history.find((item) => Number(item.id) === this.hid);
      if (!entry?.xml) {
        return Promise.reject(
          new Error(`History entry ${this.hid} could not be found for map ${mapId}`),
        );
      }
      try {
        return Promise.resolve(AjaxUtils.parseXML(entry.xml));
      } catch (e) {
        return Promise.reject(e);
      }
    }

    try {
      if (storage) {
        const saved =
          storage.getItem(`${MOCK_XML_PREFIX}${mapId}`) || storage.getItem(LEGACY_XML_KEY(mapId));
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
