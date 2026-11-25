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
import Client, {
  AccountInfo,
  AuthenticationType,
  BasicMapInfo,
  ChangeHistory,
  ImportMapInfo,
  Label,
  MapInfo,
  NewUser,
  Permission,
  Oauth2CallbackResult,
  ForgotPasswordResult,
  JwtAuth,
  MapMetadata,
} from '..';
import { LocaleCode, localeFromStr } from '../../app-i18n';
import JwtTokenConfig from '../../jwt-token-config';
import { appLogger as log } from '../../../utils/logger';

const MOCK_MAPS_KEY = 'wisemapping.mock.maps';
const MOCK_LABELS_KEY = 'wisemapping.mock.labels';
const MOCK_SEQ_KEY = 'wisemapping.mock.seq';
const MOCK_XML_PREFIX = 'wisemapping.mock.xml.';
const MOCK_PROPS_PREFIX = 'wisemapping.mock.props.';
const MOCK_HISTORY_PREFIX = 'wisemapping.mock.history.';
const MOCK_ACCOUNT_KEY = 'wisemapping.mock.account';
const LEGACY_XML_KEY = (id: number): string => `mock-map-${id}-xml`;
const DEFAULT_MOCK_EMAIL = 'owner@wisemapping.local';

type MockHistoryEntry = {
  id: number;
  xml: string;
  lastModificationBy: string;
  lastModificationTime: string;
};

type StoredMockAccount = {
  firstname?: string;
  lastname?: string;
};

const getStorage = (): Storage | undefined => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // ignore storage errors
  }
  return undefined;
};

const readJsonArray = <T>(key: string): T[] => {
  try {
    const storage = getStorage();
    const raw = storage?.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
};

const writeJson = (key: string, value: unknown): void => {
  try {
    getStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

const peekNextMockSeq = (minFloor = 0): number => {
  const storage = getStorage();
  const raw = storage?.getItem(MOCK_SEQ_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  const current = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
  return Math.max(current, minFloor) + 1;
};

const nextMockSeq = (minFloor = 0): number => {
  const storage = getStorage();
  const next = peekNextMockSeq(minFloor);
  try {
    storage?.setItem(MOCK_SEQ_KEY, String(next));
  } catch {
    // ignore storage errors
  }
  return next;
};

const escapeXmlAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildDefaultMapXml = (id: number, title: string): string =>
  `<map name="${id}" version="tango"><topic central="true" text="${escapeXmlAttr(title)}" id="1" fontStyle=";;#ffffff;;;"></topic></map>`;

const loadMockMaps = (): MapInfo[] => readJsonArray<MapInfo>(MOCK_MAPS_KEY);

const saveMockMaps = (maps: MapInfo[]): void => {
  writeJson(MOCK_MAPS_KEY, maps);
};

const loadMockLabels = (): Label[] => readJsonArray<Label>(MOCK_LABELS_KEY);

const saveMockLabels = (labels: Label[]): void => {
  writeJson(MOCK_LABELS_KEY, labels);
};

const loadMockXml = (id: number): string | null => {
  try {
    const storage = getStorage();
    return storage?.getItem(`${MOCK_XML_PREFIX}${id}`) ?? storage?.getItem(LEGACY_XML_KEY(id)) ?? null;
  } catch {
    return null;
  }
};

const saveMockXml = (id: number, xml: string): void => {
  try {
    const storage = getStorage();
    storage?.setItem(`${MOCK_XML_PREFIX}${id}`, xml);
    storage?.removeItem(LEGACY_XML_KEY(id));
  } catch {
    // ignore storage errors
  }
};

const loadMockProps = (id: number): string | null => {
  try {
    return getStorage()?.getItem(`${MOCK_PROPS_PREFIX}${id}`) ?? null;
  } catch {
    return null;
  }
};

const saveMockProps = (id: number, props: string): void => {
  try {
    getStorage()?.setItem(`${MOCK_PROPS_PREFIX}${id}`, props);
  } catch {
    // ignore storage errors
  }
};

const loadMockHistory = (id: number): MockHistoryEntry[] =>
  readJsonArray<MockHistoryEntry>(`${MOCK_HISTORY_PREFIX}${id}`);

const getStoredAccount = (): StoredMockAccount => {
  try {
    const raw = getStorage()?.getItem(MOCK_ACCOUNT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as StoredMockAccount;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
};

const getCurrentUserIdentity = (): {
  email: string;
  firstname: string;
  lastname: string;
  displayName: string;
} => {
  const token = JwtTokenConfig.retreiveToken();
  const subject = token ? JwtTokenConfig.getSubject(token) : undefined;
  const email = subject ?? (token && token.includes('@') ? token : DEFAULT_MOCK_EMAIL);
  const stored = getStoredAccount();
  const localPart = email.split('@')[0] || 'Owner';
  const firstname = stored.firstname ?? localPart;
  const lastname = stored.lastname ?? '';
  const displayName = firstname && lastname ? `${firstname} ${lastname}` : email;
  return { email, firstname, lastname, displayName };
};

class MockClient implements Client {
  private permissionsByMap: Map<number, Permission[]> = new Map();

  fetchMapInfo(id: number): Promise<MapInfo> {
    const map = loadMockMaps().find((m) => m.id === id);
    if (!map) {
      return Promise.reject(new Error(`Map could not be found ${id}`));
    }
    return Promise.resolve(map);
  }

  fetchMapMetadata(id: number, includeXml = false): Promise<MapMetadata> {
    const map = loadMockMaps().find((m) => m.id === id);
    if (!map) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const savedProps = loadMockProps(id);
    const metadata: MapMetadata = {
      id: map.id,
      title: map.title,
      creatorFullName: map.createdBy,
      isLocked: false,
      jsonProps: savedProps ?? '{ "zoom": 0.8 }',
      role: map.role,
      description: map.description,
      createdBy: map.createdBy,
      creationTime: map.creationTime,
      lastModificationBy: map.lastModificationBy,
      lastModificationTime: map.lastModificationTime,
      starred: map.starred,
      public: map.public,
    };

    if (includeXml) {
      const savedXml = loadMockXml(id);
      const hasValidXml = Boolean(
        savedXml && savedXml.includes('<map') && savedXml.includes('<topic'),
      );
      metadata.xml = hasValidXml && savedXml ? savedXml : buildDefaultMapXml(id, map.title);
    }

    return Promise.resolve(metadata);
  }

  logout(): Promise<void> {
    JwtTokenConfig.removeToken();
    return Promise.resolve();
  }

  login(auth: JwtAuth): Promise<void> {
    JwtTokenConfig.storeToken(auth.email);
    return Promise.resolve();
  }

  onSessionExpired(callback?: () => void): (() => void) | undefined {
    return callback;
  }

  deleteMapPermission(id: number, email: string): Promise<void> {
    let perm = this.permissionsByMap.get(id) || [];
    perm = perm.filter((p) => p.email !== email);
    this.permissionsByMap.set(id, perm);
    return Promise.resolve();
  }

  addMapPermissions(id: number, _message: string, permissions: Permission[]): Promise<void> {
    let perm = this.permissionsByMap.get(id) || [];
    perm = perm.concat(permissions);
    this.permissionsByMap.set(id, perm);
    return Promise.resolve();
  }

  fetchMapPermissions(id: number): Promise<Permission[]> {
    let perm = this.permissionsByMap.get(id);
    if (!perm) {
      const { displayName, email } = getCurrentUserIdentity();
      perm = [
        {
          name: displayName,
          email,
          role: 'owner',
        },
      ];
      this.permissionsByMap.set(id, perm);
    }
    return Promise.resolve(perm);
  }

  deleteAccount(): Promise<void> {
    return Promise.resolve();
  }

  updateAccountInfo(firstname: string, lastname: string): Promise<void> {
    log.debug('firstname:' + firstname, lastname);
    writeJson(MOCK_ACCOUNT_KEY, { firstname, lastname });
    return Promise.resolve();
  }

  updateAccountPassword(pasword: string): Promise<void> {
    log.debug('password:' + pasword);
    return Promise.resolve();
  }

  updateAccountLanguage(locale: LocaleCode): Promise<void> {
    try {
      getStorage()?.setItem('locale', locale);
    } catch {
      // ignore storage errors
    }
    return Promise.resolve();
  }

  importMap(model: ImportMapInfo): Promise<number> {
    log.debug('model:' + model.title);
    const maps = loadMockMaps();
    const maxMapId = maps.reduce((max, m) => (m.id > max ? m.id : max), 0);
    const id = nextMockSeq(maxMapId);
    const now = new Date().toISOString();
    const { email } = getCurrentUserIdentity();
    const newMap: MapInfo = {
      id,
      description: model.description || '',
      title: model.title,
      starred: false,
      createdBy: email,
      labels: [],
      lastModificationTime: now,
      lastModificationBy: email,
      creationTime: now,
      public: false,
      role: 'owner',
    };
    maps.push(newMap);
    saveMockMaps(maps);

    let xmlContent: string | undefined;
    if (typeof model.content === 'string' && model.content.trim()) {
      xmlContent = model.content;
    } else if (model.content instanceof ArrayBuffer) {
      const decoded = new TextDecoder().decode(model.content);
      if (decoded.trim()) {
        xmlContent = decoded;
      }
    }
    saveMockXml(id, xmlContent ?? buildDefaultMapXml(id, model.title));

    return Promise.resolve(id);
  }

  fetchAccountInfo(): Promise<AccountInfo> {
    log.debug('Fetch account info ...');
    const token = JwtTokenConfig.retreiveToken();
    if (!token) {
      return Promise.reject({ msg: 'User not authenticated', isAuth: true, status: 401 });
    }
    const { email, firstname, lastname } = getCurrentUserIdentity();
    const locale = (getStorage()?.getItem('locale') ?? undefined) as LocaleCode | undefined;
    return Promise.resolve({
      firstname,
      lastname,
      email,
      locale: locale ? localeFromStr(locale) : undefined,
      authenticationType: AuthenticationType.GOOGLE_OAUTH2,
      isAdmin: false,
    });
  }

  deleteMaps(ids: number[]): Promise<void> {
    const idSet = new Set(ids);
    const maps = loadMockMaps().filter((m) => !idSet.has(m.id));
    saveMockMaps(maps);
    ids.forEach((id) => {
      this.cleanupMapStorage(id);
    });
    return Promise.resolve();
  }

  revertHistory(id: number, cid: number): Promise<void> {
    const maps = loadMockMaps();
    const mapIndex = maps.findIndex((m) => m.id === id);
    const currentMap = mapIndex !== -1 ? maps[mapIndex] : undefined;
    if (!currentMap) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const history = loadMockHistory(id);
    const target = history.find((entry) => entry && entry.id === cid);
    if (!target || typeof target.xml !== 'string' || !target.xml.trim()) {
      return Promise.reject({ msg: 'History entry could not be found.', status: 400 });
    }

    const storage = getStorage();
    if (!storage) {
      return Promise.reject({ msg: 'Local storage is unavailable.' });
    }

    const now = new Date().toISOString();
    const { displayName } = getCurrentUserIdentity();
    const maxHistId = history.reduce(
      (max, entry) => (entry && Number.isInteger(entry.id) && entry.id > max ? entry.id : max),
      0,
    );
    const newHistId = peekNextMockSeq(maxHistId);
    const revertSnapshot: MockHistoryEntry = {
      id: newHistId,
      xml: target.xml,
      lastModificationBy: displayName,
      lastModificationTime: now,
    };

    const updatedMaps = [...maps];
    updatedMaps[mapIndex] = {
      ...currentMap,
      lastModificationTime: now,
      lastModificationBy: displayName,
    };

    try {
      // Persist the largest payload (history) first so a quota error leaves current XML/maps intact.
      storage.setItem(`${MOCK_HISTORY_PREFIX}${id}`, JSON.stringify([revertSnapshot, ...history]));
      storage.setItem(MOCK_SEQ_KEY, String(newHistId));
      storage.setItem(`${MOCK_XML_PREFIX}${id}`, target.xml);
      storage.removeItem(LEGACY_XML_KEY(id));
      storage.setItem(MOCK_MAPS_KEY, JSON.stringify(updatedMaps));
    } catch (e) {
      return Promise.reject({
        msg: e instanceof Error && e.message ? e.message : 'Failed to revert history.',
      });
    }
    return Promise.resolve();
  }

  createMap(map: BasicMapInfo): Promise<number> {
    const maps = loadMockMaps();
    const maxMapId = maps.reduce((max, m) => (m.id > max ? m.id : max), 0);
    const id = nextMockSeq(maxMapId);
    const now = new Date().toISOString();
    const { email } = getCurrentUserIdentity();
    const newMap: MapInfo = {
      id,
      description: map.description || '',
      title: map.title,
      starred: false,
      createdBy: email,
      labels: [],
      lastModificationTime: now,
      lastModificationBy: email,
      creationTime: now,
      public: false,
      role: 'owner',
    };
    maps.push(newMap);
    saveMockMaps(maps);
    saveMockXml(id, buildDefaultMapXml(id, map.title));
    return Promise.resolve(id);
  }

  fetchLabels(): Promise<Label[]> {
    log.debug('Fetching  labels from server');
    return Promise.resolve(loadMockLabels());
  }

  updateMapToPublic(id: number, isPublic: boolean): Promise<void> {
    const maps = loadMockMaps();
    const mapInfo = maps.find((m) => m.id === id);
    if (mapInfo) {
      mapInfo.public = isPublic;
      saveMockMaps(maps);
    }
    return Promise.resolve();
  }

  updateStarred(id: number, starred: boolean): Promise<void> {
    const maps = loadMockMaps();
    const mapInfo = maps.find((m) => m.id === id);
    if (!mapInfo) {
      log.debug(`Could not find the map with id ${id}`);
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }
    mapInfo.starred = starred;
    saveMockMaps(maps);
    return Promise.resolve();
  }

  renameMap(id: number, basicInfo: Partial<BasicMapInfo>): Promise<void> {
    const maps = loadMockMaps();
    const target = maps.find((m) => m.id === id);
    if (!target) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const exists =
      basicInfo.title !== undefined &&
      maps.some((m) => m.id !== id && m.title === basicInfo.title);
    if (!exists) {
      const now = new Date().toISOString();
      const { email } = getCurrentUserIdentity();
      const updated = maps.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            ...(basicInfo.description !== undefined ? { description: basicInfo.description } : {}),
            ...(basicInfo.title !== undefined ? { title: basicInfo.title } : {}),
            lastModificationTime: now,
            lastModificationBy: email,
          };
        }
        return m;
      });
      saveMockMaps(updated);
      return Promise.resolve();
    }

    return Promise.reject({
      msg: 'Map already exists ...' + basicInfo.title,
      fields: {
        name: 'name already exists ',
        title: 'name already exists ',
      },
    });
  }

  fetchHistory(id: number): Promise<ChangeHistory[]> {
    log.debug(`Fetching history for ${id}`);
    const maps = loadMockMaps();
    if (!maps.some((m) => m.id === id)) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const history = loadMockHistory(id)
      .filter(
        (entry): entry is MockHistoryEntry =>
          Boolean(entry) &&
          typeof entry.id === 'number' &&
          Number.isFinite(entry.id) &&
          typeof entry.lastModificationTime === 'string',
      )
      .map((entry) => ({
        id: entry.id,
        lastModificationBy: entry.lastModificationBy || 'Local User',
        lastModificationTime: entry.lastModificationTime,
      }));
    return Promise.resolve(history);
  }

  duplicateMap(id: number, basicInfo: BasicMapInfo): Promise<number> {
    const maps = loadMockMaps();
    const source = maps.find((m) => m.id === id);
    if (!source) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const exists = maps.some((m) => m.title === basicInfo.title);
    if (exists) {
      return Promise.reject({
        msg: 'Maps name must be unique:' + basicInfo.title,
        fields: {
          name: 'name already exists ',
          title: 'name already exists ',
        },
      });
    }

    const maxMapId = maps.reduce((max, m) => (m.id > max ? m.id : max), 0);
    const newId = nextMockSeq(maxMapId);
    const now = new Date().toISOString();
    const { email } = getCurrentUserIdentity();

    const newMap: MapInfo = {
      id: newId,
      description: basicInfo.description || '',
      title: basicInfo.title,
      starred: false,
      createdBy: email,
      labels: [],
      lastModificationTime: now,
      lastModificationBy: email,
      creationTime: now,
      public: false,
      role: 'owner',
    };
    maps.push(newMap);
    saveMockMaps(maps);

    const sourceXml = loadMockXml(id) ?? buildDefaultMapXml(newId, basicInfo.title);
    saveMockXml(newId, sourceXml);

    const sourceProps = loadMockProps(id);
    if (sourceProps !== null) {
      saveMockProps(newId, sourceProps);
    }

    return Promise.resolve(newId);
  }

  createLabel(title: string, color: string): Promise<number> {
    const labels = loadMockLabels();
    const maxId = labels.reduce((max, l) => (l.id > max ? l.id : max), 0);
    const newId = nextMockSeq(maxId);
    labels.push({
      id: newId,
      title,
      color,
    });
    saveMockLabels(labels);
    return Promise.resolve(newId);
  }

  deleteLabel(id: number): Promise<void> {
    const labels = loadMockLabels().filter((l) => l.id !== id);
    saveMockLabels(labels);
    const maps = loadMockMaps().map((m) => ({
      ...m,
      labels: m.labels.filter((l) => l.id !== id),
    }));
    saveMockMaps(maps);
    return Promise.resolve();
  }

  addLabelToMap(labelId: number, mapId: number): Promise<void> {
    const labels = loadMockLabels();
    const labelToAdd = labels.find((l) => l.id === labelId);
    if (!labelToAdd) {
      return Promise.reject({ msg: `unable to find label with id ${labelId}` });
    }
    const maps = loadMockMaps();
    const map = maps.find((m) => m.id === mapId);
    if (!map) {
      return Promise.reject({ msg: `unable to find map with id ${mapId}` });
    }
    if (!map.labels.some((l) => l.id === labelId)) {
      map.labels.push(labelToAdd);
      saveMockMaps(maps);
    }
    return Promise.resolve();
  }

  deleteLabelFromMap(labelId: number, mapId: number): Promise<void> {
    const maps = loadMockMaps();
    const map = maps.find((m) => m.id === mapId);
    if (!map) {
      return Promise.reject({ msg: `unable to find map with id ${mapId}` });
    }
    map.labels = map.labels.filter((l) => l.id !== labelId);
    saveMockMaps(maps);
    return Promise.resolve();
  }

  deleteMap(id: number): Promise<void> {
    const maps = loadMockMaps().filter((m) => m.id !== id);
    saveMockMaps(maps);
    this.cleanupMapStorage(id);
    return Promise.resolve();
  }

  private cleanupMapStorage(id: number): void {
    this.permissionsByMap.delete(id);
    try {
      const storage = getStorage();
      storage?.removeItem(`${MOCK_XML_PREFIX}${id}`);
      storage?.removeItem(LEGACY_XML_KEY(id));
      storage?.removeItem(`${MOCK_PROPS_PREFIX}${id}`);
      storage?.removeItem(`${MOCK_HISTORY_PREFIX}${id}`);
    } catch {
      // ignore storage errors
    }
  }

  registerNewUser(user: NewUser): Promise<void> {
    if (user.email === 'error@example.com') {
      return Promise.reject({ msg: 'Unexpected error' });
    }
    return Promise.resolve();
  }

  fetchAllMaps(): Promise<MapInfo[]> {
    log.debug('Fetching  maps from server');
    return Promise.resolve(loadMockMaps());
  }

  resetPassword(_email: string): Promise<ForgotPasswordResult> {
    return Promise.resolve({ action: 'EMAIL_SENT' });
  }

  resetPasswordFromToken(_token: string, _newPassword: string): Promise<void> {
    return Promise.resolve();
  }

  activateAccount(code: string): Promise<void> {
    log.debug('Activating account with code:' + code);
    if (code === '999999999') {
      return Promise.reject({
        msg: 'Invalid activation code. The link may be incorrect or expired.',
      });
    }
    return Promise.resolve();
  }

  processGoogleCallback(): Promise<Oauth2CallbackResult> {
    return Promise.resolve({
      email: getCurrentUserIdentity().email,
      oauthSync: true,
    });
  }

  processFacebookCallback(): Promise<Oauth2CallbackResult> {
    return Promise.resolve({
      email: getCurrentUserIdentity().email,
      oauthSync: true,
    });
  }

  confirmAccountSync(
    _email?: string,
    _code?: string,
    _provider?: string,
  ): Promise<Oauth2CallbackResult> {
    return this.processGoogleCallback();
  }
}

export default MockClient;
