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
  Folder,
  MapInfo,
  Oauth2CallbackResult,
  JwtAuth,
  MapMetadata,
} from '..';
import { LocaleCode, localeFromStr } from '../../app-i18n';
import JwtTokenConfig from '../../jwt-token-config';
import { appLogger as log } from '../../../utils/logger';
import { normalizeFolderPath, validateMapTitleInput } from '../../../utils/mapPath';
import { extractMapPreview, getUtf8ByteLength } from '../../../utils/mapPreview';

const MOCK_MAPS_KEY = 'wisemapping.mock.maps';
const MOCK_LABELS_KEY = 'wisemapping.mock.labels';
const MOCK_FOLDERS_KEY = 'wisemapping.mock.folders';
const MOCK_SEQ_KEY = 'wisemapping.mock.seq';
const MOCK_XML_PREFIX = 'wisemapping.mock.xml.';
const MOCK_PROPS_PREFIX = 'wisemapping.mock.props.';
const MOCK_HISTORY_PREFIX = 'wisemapping.mock.history.';
const LEGACY_XML_KEY = (id: number): string => `mock-map-${id}-xml`;
const DEFAULT_MOCK_EMAIL = 'owner@wisemapping.local';

type MockHistoryEntry = {
  id: number;
  xml: string;
  lastModificationBy: string;
  lastModificationTime: string;
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

const loadMockFolders = (): Folder[] => readJsonArray<Folder>(MOCK_FOLDERS_KEY);

const saveMockFolders = (folders: Folder[]): void => {
  writeJson(MOCK_FOLDERS_KEY, folders);
};

const buildMockFolderPath = (folders: Folder[], folderId: number | null | undefined): string => {
  if (folderId === undefined || folderId === null) {
    return '';
  }
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const visited = new Set<number>();
  let cur: number | null = folderId;
  while (cur !== null && !visited.has(cur)) {
    visited.add(cur);
    const f = byId.get(cur);
    if (!f) {
      break;
    }
    parts.unshift(f.name);
    cur = f.parentId ?? null;
  }
  return parts.length > 0 ? `${parts.join('/')}/` : '';
};

const resolveOrCreateMockFolderPath = (
  rawPath: string,
): { folderId: number | null; folderPath: string } => {
  const segments = rawPath
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length === 0) {
    return { folderId: null, folderPath: '' };
  }
  const folders = loadMockFolders();
  let parentId: number | null = null;
  let changed = false;
  const normalized: string[] = [];
  for (const rawSeg of segments) {
    const seg = rawSeg.slice(0, 100);
    normalized.push(seg);
    const existing = folders.find((f) => (f.parentId ?? null) === parentId && f.name === seg);
    if (existing) {
      parentId = existing.id;
    } else {
      const maxId = folders.reduce((max, f) => (f.id > max ? f.id : max), 0);
      const id = nextMockSeq(maxId);
      const now = new Date().toISOString();
      folders.push({
        id,
        name: seg,
        parentId,
        creationTime: now,
        updatedTime: now,
      });
      changed = true;
      parentId = id;
    }
  }
  if (changed) {
    saveMockFolders(folders);
  }
  return { folderId: parentId, folderPath: `${normalized.join('/')}/` };
};

const resolveUniqueMockName = (base: string, occupied: Set<string>, maxLen: number): string => {
  if (!occupied.has(base)) {
    return base;
  }
  let n = 2;
  while (n < 10000) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`;
    if (!occupied.has(candidate)) {
      return candidate;
    }
    n += 1;
  }
  return base;
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

const getCurrentUserIdentity = (): {
  email: string;
  firstname: string;
  lastname: string;
  displayName: string;
} => {
  const token = JwtTokenConfig.retreiveToken();
  const subject = token ? JwtTokenConfig.getSubject(token) : undefined;
  const email = subject ?? (token && token.includes('@') ? token : DEFAULT_MOCK_EMAIL);
  const localPart = email.split('@')[0] || 'Owner';
  const firstname = localPart;
  const lastname = '';
  const displayName = email;
  return { email, firstname, lastname, displayName };
};

class MockClient implements Client {
  fetchMapMetadata(id: number, includeXml = false): Promise<MapMetadata> {
    const maps = loadMockMaps();
    const mapIndex = maps.findIndex((m) => m.id === id);
    const map = mapIndex !== -1 ? maps[mapIndex] : undefined;
    if (!map) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const now = new Date().toISOString();
    if (includeXml) {
      maps[mapIndex] = { ...map, lastOpenTime: now };
      saveMockMaps(maps);
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
      folderId: map.folderId ?? null,
      folderPath: map.folderPath ?? '',
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

  fetchMapMetadataByPath(
    folderPath: string,
    title: string,
    includeXml = false,
  ): Promise<MapMetadata> {
    const normalizedPath = normalizeFolderPath(folderPath);
    const normalizedTitle = title.trim();
    const map = loadMockMaps().find(
      (m) => normalizeFolderPath(m.folderPath) === normalizedPath && m.title === normalizedTitle,
    );
    if (!map) {
      return Promise.reject({
        msg: `Map could not be found: ${normalizedPath}${normalizedTitle}`,
        status: 404,
      });
    }
    return this.fetchMapMetadata(map.id, includeXml);
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

  importMap(model: ImportMapInfo): Promise<number> {
    log.debug('model:' + model.title);
    const maps = loadMockMaps();
    const folders = loadMockFolders();
    let folderId: number | null = model.folderId ?? null;
    let folderPath = '';
    if (folderId !== null) {
      folderPath = buildMockFolderPath(folders, folderId);
    } else if (model.folderPath?.trim()) {
      const resolved = resolveOrCreateMockFolderPath(model.folderPath);
      folderId = resolved.folderId;
      folderPath = resolved.folderPath;
    }

    const existing = maps.find(
      (m) => (m.folderId ?? null) === folderId && m.title === model.title,
    );
    if (existing) {
      if (!model.overwrite) {
        return Promise.reject({
          errorCode: 'DUPLICATE_MAP_TITLE',
          fields: { title: 'You have already a map with the same name' },
          msg: 'You have already a map with the same name',
        });
      }
      const now = new Date().toISOString();
      const { email } = getCurrentUserIdentity();
      existing.description = model.description || '';
      existing.lastModificationTime = now;
      existing.lastModificationBy = email;
      saveMockMaps(maps);
      if (typeof model.content === 'string' && model.content.trim()) {
        saveMockXml(existing.id, model.content);
      }
      return Promise.resolve(existing.id);
    }

    const maxMapId = maps.reduce((max, m) => (m.id > max ? m.id : max), 0);
    const id = nextMockSeq(maxMapId);
    const now = new Date().toISOString();
    const { email } = getCurrentUserIdentity();
    const newMap: MapInfo = {
      id,
      description: model.description || '',
      title: model.title,
      folderId,
      folderPath,
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
    const { email, firstname, lastname, displayName } = getCurrentUserIdentity();
    const locale = (getStorage()?.getItem('locale') ?? undefined) as LocaleCode | undefined;
    return Promise.resolve({
      firstname,
      lastname,
      fullName: displayName,
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
    if (validateMapTitleInput(map.title) === 'slash') {
      return Promise.reject({
        msg: '导图名称不能包含斜杠（/ 或 \\）。',
        fields: { title: '导图名称不能包含斜杠（/ 或 \\）。' },
      });
    }
    const maps = loadMockMaps();
    const folders = loadMockFolders();
    const folderId = map.folderId ?? null;
    const folderPath = buildMockFolderPath(folders, folderId);
    if (maps.some((m) => (m.folderId ?? null) === folderId && m.title === map.title)) {
      return Promise.reject({
        errorCode: 'DUPLICATE_MAP_TITLE',
        msg: 'Map already exists: ' + map.title,
        fields: {
          name: 'name already exists ',
          title: 'name already exists ',
        },
      });
    }
    const maxMapId = maps.reduce((max, m) => (m.id > max ? m.id : max), 0);
    const id = nextMockSeq(maxMapId);
    const now = new Date().toISOString();
    const { email } = getCurrentUserIdentity();
    const newMap: MapInfo = {
      id,
      description: map.description || '',
      title: map.title,
      folderId,
      folderPath,
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
    if (basicInfo.title !== undefined && validateMapTitleInput(basicInfo.title) === 'slash') {
      return Promise.reject({
        msg: '导图名称不能包含斜杠（/ 或 \\）。',
        fields: { title: '导图名称不能包含斜杠（/ 或 \\）。' },
      });
    }
    const maps = loadMockMaps();
    const target = maps.find((m) => m.id === id);
    if (!target) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const exists =
      basicInfo.title !== undefined &&
      maps.some(
        (m) =>
          m.id !== id &&
          (m.folderId ?? null) === (target.folderId ?? null) &&
          m.title === basicInfo.title,
      );
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
    if (validateMapTitleInput(basicInfo.title) === 'slash') {
      return Promise.reject({
        msg: '导图名称不能包含斜杠（/ 或 \\）。',
        fields: { title: '导图名称不能包含斜杠（/ 或 \\）。' },
      });
    }
    const maps = loadMockMaps();
    const source = maps.find((m) => m.id === id);
    if (!source) {
      return Promise.reject({ msg: `Map could not be found ${id}`, status: 404 });
    }

    const exists = maps.some(
      (m) => (m.folderId ?? null) === (source.folderId ?? null) && m.title === basicInfo.title,
    );
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
      folderId: source.folderId ?? null,
      folderPath: source.folderPath ?? '',
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

  fetchFolders(): Promise<Folder[]> {
    const folders = loadMockFolders();
    return Promise.resolve(
      [...folders].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
    );
  }

  createFolder(name: string, parentId: number | null = null): Promise<Folder> {
    const trimmed = name.trim();
    if (!trimmed || /[\\/]/.test(trimmed)) {
      return Promise.reject({
        fields: { name: '文件夹名称不能为空且不能包含斜杠。' },
        msg: '文件夹名称不能为空且不能包含斜杠。',
      });
    }
    const folders = loadMockFolders();
    if (parentId !== null && !folders.some((f) => f.id === parentId)) {
      return Promise.reject({ msg: 'Parent folder not found', status: 404 });
    }
    if (folders.some((f) => (f.parentId ?? null) === parentId && f.name === trimmed)) {
      return Promise.reject({
        errorCode: 'DUPLICATE_FOLDER_NAME',
        fields: { name: '同级目录下已存在同名文件夹。' },
        msg: '同级目录下已存在同名文件夹。',
      });
    }
    const maxId = folders.reduce((max, f) => (f.id > max ? f.id : max), 0);
    const id = nextMockSeq(maxId);
    const now = new Date().toISOString();
    const folder: Folder = {
      id,
      name: trimmed,
      parentId,
      creationTime: now,
      updatedTime: now,
    };
    folders.push(folder);
    saveMockFolders(folders);
    return Promise.resolve(folder);
  }

  updateFolder(
    id: number,
    changes: { name?: string; parentId?: number | null },
  ): Promise<Folder> {
    const folders = loadMockFolders();
    const target = folders.find((f) => f.id === id);
    if (!target) {
      return Promise.reject({ msg: 'Folder not found', status: 404 });
    }
    const nextName = changes.name !== undefined ? changes.name.trim() : target.name;
    const nextParentId =
      changes.parentId !== undefined ? changes.parentId : (target.parentId ?? null);
    if (!nextName || /[\\/]/.test(nextName)) {
      return Promise.reject({
        fields: { name: '文件夹名称不能为空且不能包含斜杠。' },
        msg: '文件夹名称不能为空且不能包含斜杠。',
      });
    }
    if (nextParentId !== null) {
      if (!folders.some((f) => f.id === nextParentId)) {
        return Promise.reject({ msg: 'Parent folder not found', status: 404 });
      }
      const byId = new Map(folders.map((f) => [f.id, f]));
      const visited = new Set<number>();
      let cur: number | null = nextParentId;
      while (cur !== null && !visited.has(cur)) {
        if (cur === id) {
          return Promise.reject({
            errorCode: 'FOLDER_CYCLE',
            msg: '不能将文件夹移动到自身或其子文件夹下。',
          });
        }
        visited.add(cur);
        cur = byId.get(cur)?.parentId ?? null;
      }
    }
    if (
      folders.some(
        (f) => f.id !== id && (f.parentId ?? null) === nextParentId && f.name === nextName,
      )
    ) {
      return Promise.reject({
        errorCode: 'DUPLICATE_FOLDER_NAME',
        fields: { name: '同级目录下已存在同名文件夹。' },
        msg: '同级目录下已存在同名文件夹。',
      });
    }
    target.name = nextName;
    target.parentId = nextParentId;
    target.updatedTime = new Date().toISOString();
    saveMockFolders(folders);

    const maps = loadMockMaps().map((m) => ({
      ...m,
      folderPath: buildMockFolderPath(folders, m.folderId),
    }));
    saveMockMaps(maps);
    return Promise.resolve({ ...target });
  }

  deleteFolder(id: number): Promise<void> {
    const folders = loadMockFolders();
    const target = folders.find((f) => f.id === id);
    if (!target) {
      return Promise.reject({ msg: 'Folder not found', status: 404 });
    }
    const remainingFolders = folders.filter((f) => f.id !== id);
    const rootFolderNames = new Set(
      remainingFolders.filter((f) => (f.parentId ?? null) === null).map((f) => f.name),
    );
    remainingFolders.forEach((f) => {
      if (f.parentId === id) {
        const nextName = resolveUniqueMockName(f.name, rootFolderNames, 100);
        rootFolderNames.add(nextName);
        f.parentId = null;
        f.name = nextName;
        f.updatedTime = new Date().toISOString();
      }
    });
    saveMockFolders(remainingFolders);

    const maps = loadMockMaps();
    const rootMapTitles = new Set(
      maps.filter((m) => (m.folderId ?? null) === null).map((m) => m.title),
    );
    const updatedMaps = maps.map((m) => {
      if (m.folderId === id) {
        const nextTitle = resolveUniqueMockName(m.title, rootMapTitles, 255);
        rootMapTitles.add(nextTitle);
        return { ...m, folderId: null, folderPath: '', title: nextTitle };
      }
      return {
        ...m,
        folderPath: buildMockFolderPath(remainingFolders, m.folderId),
      };
    });
    saveMockMaps(updatedMaps);
    return Promise.resolve();
  }

  moveMapsToFolder(mapIds: number[], folderId: number | null): Promise<void> {
    const folders = loadMockFolders();
    if (folderId !== null && !folders.some((f) => f.id === folderId)) {
      return Promise.reject({ msg: 'Target folder not found', status: 404 });
    }
    const maps = loadMockMaps();
    const idSet = new Set(mapIds);
    const occupied = new Set(
      maps
        .filter((m) => (m.folderId ?? null) === folderId && !idSet.has(m.id))
        .map((m) => m.title),
    );
    for (const m of maps) {
      if (idSet.has(m.id)) {
        if (occupied.has(m.title)) {
          return Promise.reject({
            errorCode: 'DUPLICATE_MAP_TITLE',
            msg: `目标文件夹中已存在同名导图“${m.title}”。`,
          });
        }
        occupied.add(m.title);
      }
    }
    const targetPath = buildMockFolderPath(folders, folderId);
    const updatedMaps = maps.map((m) =>
      idSet.has(m.id) ? { ...m, folderId, folderPath: targetPath } : m,
    );
    saveMockMaps(updatedMaps);
    return Promise.resolve();
  }

  deleteMap(id: number): Promise<void> {
    const maps = loadMockMaps().filter((m) => m.id !== id);
    saveMockMaps(maps);
    this.cleanupMapStorage(id);
    return Promise.resolve();
  }

  private cleanupMapStorage(id: number): void {
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

  fetchAllMaps(): Promise<MapInfo[]> {
    log.debug('Fetching  maps from server');
    const maps = loadMockMaps().map((m) => {
      const xml = loadMockXml(m.id) ?? buildDefaultMapXml(m.id, m.title);
      return {
        ...m,
        lastOpenTime: m.lastOpenTime ?? m.lastModificationTime,
        sizeBytes: getUtf8ByteLength(xml),
        preview: extractMapPreview(xml, m.title),
      };
    });
    return Promise.resolve(maps);
  }

  processGoogleCallback(): Promise<Oauth2CallbackResult> {
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
