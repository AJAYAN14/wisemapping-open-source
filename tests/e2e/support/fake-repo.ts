import crypto from 'node:crypto';
import {
  ATTACKER_UUID,
  DEFAULT_ALLOWED_EMAIL,
  DEFAULT_OWNER_UUID,
  createDefaultMapXml,
} from './fixtures';

export class FakePgError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FakePgError';
    this.code = code;
  }
}

export interface FakeUserRecord {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  locale: string;
  authenticationType: 'GOOGLE_OAUTH2';
  isActive: boolean;
  isSuspended: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface FakeFolderRecord {
  id: number;
  ownerId: string;
  name: string;
  parentId: number | null;
  creationTime: string;
  updatedTime: string;
}

export interface FakeMindmapRecord {
  id: number;
  ownerId: string;
  title: string;
  description: string;
  folderId: number | null;
  folderPath: string;
  xml: string;
  properties: string;
  starred: boolean;
  version: number;
  isPublic: false;
  lastModificationBy: string;
  creationTime: string;
  lastModificationTime: string;
}

export interface FakeHistoryRecord {
  id: number;
  mindmapId: number;
  ownerId: string;
  xml: string;
  editorName: string;
  creationTime: string;
}

export interface FakeLabelRecord {
  id: number;
  ownerId: string;
  title: string;
  color: string;
  iconName: string;
  parentLabelId: number | null;
  creationTime: string;
}

export type FakeUpdateDocumentResult =
  | { status: 'ok'; mindmap: FakeMindmapRecord; historyEntry?: FakeHistoryRecord }
  | { status: 'not_found' }
  | { status: 'conflict'; currentVersion: number };

export class FakeStore {
  private users = new Map<string, FakeUserRecord>();
  private mindmaps = new Map<number, FakeMindmapRecord>();
  private mindmapHistory = new Map<number, FakeHistoryRecord>();
  private labels = new Map<number, FakeLabelRecord>();
  private folders = new Map<number, FakeFolderRecord>();
  private mindmapLabels = new Set<string>();

  private nextMapId = 1;
  private nextHistoryId = 1;
  private nextLabelId = 1;
  private nextFolderId = 1;

  constructor() {
    this.seedDefaultOwner();
  }

  reset(): void {
    this.users.clear();
    this.mindmaps.clear();
    this.mindmapHistory.clear();
    this.labels.clear();
    this.folders.clear();
    this.mindmapLabels.clear();
    this.nextMapId = 1;
    this.nextHistoryId = 1;
    this.nextLabelId = 1;
    this.nextFolderId = 1;
    this.seedDefaultOwner();
  }

  private seedDefaultOwner(): void {
    this.users.set(DEFAULT_OWNER_UUID, {
      id: DEFAULT_OWNER_UUID,
      email: DEFAULT_ALLOWED_EMAIL,
      firstname: 'Jian',
      lastname: 'Owner',
      locale: 'en',
      authenticationType: 'GOOGLE_OAUTH2',
      isActive: true,
      isSuspended: false,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    });
  }

  upsertUser(input: Partial<FakeUserRecord> & { id: string; email: string }): FakeUserRecord {
    const existing = this.users.get(input.id);
    const normalizedEmail = input.email.toLowerCase();
    const record: FakeUserRecord = {
      id: input.id,
      email: normalizedEmail,
      firstname: input.firstname ?? existing?.firstname ?? 'Owner',
      lastname: input.lastname ?? existing?.lastname ?? 'User',
      locale: input.locale ?? existing?.locale ?? 'en',
      authenticationType: 'GOOGLE_OAUTH2',
      isActive: input.isActive ?? existing?.isActive ?? true,
      isSuspended: input.isSuspended ?? existing?.isSuspended ?? false,
      isAdmin: input.isAdmin ?? existing?.isAdmin ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.users.set(record.id, record);
    return { ...record };
  }

  getUserById(uid: string): FakeUserRecord | undefined {
    const user = this.users.get(uid);
    return user ? { ...user } : undefined;
  }

  getUserByEmail(email: string): FakeUserRecord | undefined {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return { ...user };
      }
    }
    return undefined;
  }

  updateUserField(
    uid: string,
    field: 'firstname' | 'lastname' | 'locale',
    value: string,
  ): FakeUserRecord | undefined {
    const existing = this.users.get(uid);
    if (!existing) {
      return undefined;
    }
    existing[field] = value;
    return { ...existing };
  }

  private buildFolderPath(ownerId: string, folderId: number | null): string {
    if (folderId === null) {
      return '';
    }
    const parts: string[] = [];
    const visited = new Set<number>();
    let cur: number | null = folderId;
    while (cur !== null && !visited.has(cur)) {
      visited.add(cur);
      const f = this.folders.get(cur);
      if (!f || f.ownerId !== ownerId) {
        break;
      }
      parts.unshift(f.name);
      cur = f.parentId;
    }
    return parts.length > 0 ? `${parts.join('/')}/` : '';
  }

  private syncFolderPaths(ownerId: string): void {
    for (const m of this.mindmaps.values()) {
      if (m.ownerId === ownerId) {
        m.folderPath = this.buildFolderPath(ownerId, m.folderId);
      }
    }
  }

  private resolveOrCreateFolderPath(
    ownerId: string,
    rawPath: string,
  ): { folderId: number | null; folderPath: string } {
    const segments = rawPath
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (segments.length === 0) {
      return { folderId: null, folderPath: '' };
    }
    let parentId: number | null = null;
    const normalized: string[] = [];
    for (const rawSeg of segments) {
      const seg = rawSeg.slice(0, 100);
      normalized.push(seg);
      const existing = Array.from(this.folders.values()).find(
        (f) => f.ownerId === ownerId && f.parentId === parentId && f.name === seg,
      );
      if (existing) {
        parentId = existing.id;
      } else {
        const now = new Date().toISOString();
        const id = this.nextFolderId++;
        this.folders.set(id, {
          id,
          ownerId,
          name: seg,
          parentId,
          creationTime: now,
          updatedTime: now,
        });
        parentId = id;
      }
    }
    return { folderId: parentId, folderPath: `${normalized.join('/')}/` };
  }

  createMindmap(input: {
    ownerId: string;
    ownerEmail: string;
    ownerName?: string;
    title: string;
    description?: string;
    folderId?: number | null;
    folderPath?: string;
    xml?: string;
    properties?: string;
  }): FakeMindmapRecord {
    let folderId: number | null = input.folderId ?? null;
    let folderPath = '';
    if (folderId !== null) {
      const folder = this.folders.get(folderId);
      if (!folder || folder.ownerId !== input.ownerId) {
        throw new FakePgError('23503', 'Folder not found');
      }
      folderPath = this.buildFolderPath(input.ownerId, folderId);
    } else if (input.folderPath?.trim()) {
      const resolved = this.resolveOrCreateFolderPath(input.ownerId, input.folderPath);
      folderId = resolved.folderId;
      folderPath = resolved.folderPath;
    }

    for (const existing of this.mindmaps.values()) {
      if (
        existing.ownerId === input.ownerId &&
        existing.title === input.title &&
        existing.folderId === folderId
      ) {
        throw new FakePgError('23505', `Duplicate mindmap title "${input.title}" for owner`);
      }
    }

    const now = new Date().toISOString();
    const id = this.nextMapId++;
    const editor = input.ownerName?.trim() || input.ownerEmail.split('@')[0] || 'User';
    const record: FakeMindmapRecord = {
      id,
      ownerId: input.ownerId,
      title: input.title,
      description: input.description ?? '',
      folderId,
      folderPath,
      xml: input.xml ?? createDefaultMapXml(input.title),
      properties: input.properties ?? '{"zoom":0.8}',
      starred: false,
      version: 1,
      isPublic: false,
      lastModificationBy: editor,
      creationTime: now,
      lastModificationTime: now,
    };
    this.mindmaps.set(id, record);
    return { ...record };
  }

  getMindmap(ownerId: string, id: number): FakeMindmapRecord | undefined {
    const record = this.mindmaps.get(id);
    if (!record || record.ownerId !== ownerId) {
      return undefined;
    }
    return { ...record };
  }

  listMindmaps(ownerId: string, q?: string): FakeMindmapRecord[] {
    const owned = Array.from(this.mindmaps.values()).filter((m) => m.ownerId === ownerId);
    const filter = q?.trim() ?? '';
    if (!filter || filter === 'all' || filter === 'my_maps') {
      return owned.map((m) => ({ ...m }));
    }
    if (filter === 'starred') {
      return owned.filter((m) => m.starred).map((m) => ({ ...m }));
    }
    if (filter === 'public' || filter === 'shared_with_me') {
      return [];
    }

    const matchingLabelIds = new Set(
      Array.from(this.labels.values())
        .filter((lbl) => lbl.ownerId === ownerId && lbl.title === filter)
        .map((lbl) => lbl.id),
    );
    if (matchingLabelIds.size > 0) {
      return owned
        .filter((m) => {
          for (const lblId of matchingLabelIds) {
            if (this.mindmapLabels.has(this.joinKey(m.id, lblId, ownerId))) {
              return true;
            }
          }
          return false;
        })
        .map((m) => ({ ...m }));
    }

    return [];
  }

  updateMindmapDocument(input: {
    ownerId: string;
    ownerEmail: string;
    ownerName?: string;
    id: number;
    xml?: string;
    properties?: string;
    title?: string;
    description?: string;
    expectedVersion?: number;
    minor?: boolean;
  }): FakeUpdateDocumentResult {
    const record = this.mindmaps.get(input.id);
    if (!record || record.ownerId !== input.ownerId) {
      return { status: 'not_found' };
    }
    if (input.expectedVersion !== undefined && record.version !== input.expectedVersion) {
      return { status: 'conflict', currentVersion: record.version };
    }

    if (input.title !== undefined && input.title !== record.title) {
      for (const other of this.mindmaps.values()) {
        if (
          other.ownerId === input.ownerId &&
          other.id !== record.id &&
          other.folderId === record.folderId &&
          other.title === input.title
        ) {
          throw new FakePgError('23505', `Duplicate mindmap title "${input.title}"`);
        }
      }
    }

    const now = new Date().toISOString();
    const editor = input.ownerName?.trim() || input.ownerEmail.split('@')[0] || 'User';

    if (input.xml !== undefined) {
      record.xml = input.xml;
    }
    if (input.properties !== undefined) {
      record.properties = input.properties;
    }
    if (input.title !== undefined) {
      record.title = input.title;
    }
    if (input.description !== undefined) {
      record.description = input.description;
    }
    record.version += 1;
    record.lastModificationBy = editor;
    record.lastModificationTime = now;

    let historyEntry: FakeHistoryRecord | undefined;
    if (!input.minor) {
      const hid = this.nextHistoryId++;
      historyEntry = {
        id: hid,
        mindmapId: record.id,
        ownerId: input.ownerId,
        xml: record.xml,
        editorName: editor,
        creationTime: now,
      };
      this.mindmapHistory.set(hid, historyEntry);
    }

    return {
      status: 'ok',
      mindmap: { ...record },
      ...(historyEntry ? { historyEntry: { ...historyEntry } } : {}),
    };
  }

  updateMindmapTitle(
    ownerId: string,
    id: number,
    title: string,
    editorName?: string,
  ): FakeMindmapRecord | undefined {
    const record = this.mindmaps.get(id);
    if (!record || record.ownerId !== ownerId) {
      return undefined;
    }
    for (const other of this.mindmaps.values()) {
      if (
        other.ownerId === ownerId &&
        other.id !== id &&
        other.folderId === record.folderId &&
        other.title === title
      ) {
        throw new FakePgError('23505', `Duplicate mindmap title "${title}"`);
      }
    }
    record.title = title;
    if (editorName) {
      record.lastModificationBy = editorName;
    }
    record.lastModificationTime = new Date().toISOString();
    return { ...record };
  }

  updateMindmapDescription(
    ownerId: string,
    id: number,
    description: string,
    editorName?: string,
  ): FakeMindmapRecord | undefined {
    const record = this.mindmaps.get(id);
    if (!record || record.ownerId !== ownerId) {
      return undefined;
    }
    record.description = description.trim();
    if (editorName) {
      record.lastModificationBy = editorName;
    }
    record.lastModificationTime = new Date().toISOString();
    return { ...record };
  }

  updateMindmapStarred(ownerId: string, id: number, starred: boolean): FakeMindmapRecord | undefined {
    const record = this.mindmaps.get(id);
    if (!record || record.ownerId !== ownerId) {
      return undefined;
    }
    record.starred = starred;
    return { ...record };
  }

  duplicateMindmap(
    ownerId: string,
    ownerEmail: string,
    sourceId: number,
    newTitle: string,
    newDescription?: string,
    ownerName?: string,
  ): FakeMindmapRecord | undefined {
    const source = this.mindmaps.get(sourceId);
    if (!source || source.ownerId !== ownerId) {
      return undefined;
    }
    return this.createMindmap({
      ownerId,
      ownerEmail,
      ownerName,
      title: newTitle,
      description: newDescription ?? source.description,
      folderId: source.folderId,
      xml: source.xml,
      properties: source.properties,
    });
  }

  deleteMindmap(ownerId: string, id: number): boolean {
    const record = this.mindmaps.get(id);
    if (!record || record.ownerId !== ownerId) {
      return false;
    }
    this.mindmaps.delete(id);
    for (const [hid, history] of this.mindmapHistory.entries()) {
      if (history.mindmapId === id && history.ownerId === ownerId) {
        this.mindmapHistory.delete(hid);
      }
    }
    for (const key of Array.from(this.mindmapLabels.values())) {
      if (key.startsWith(`${id}:`)) {
        this.mindmapLabels.delete(key);
      }
    }
    return true;
  }

  batchDeleteMindmaps(ownerId: string, ids: number[]): boolean {
    for (const id of ids) {
      const record = this.mindmaps.get(id);
      if (!record || record.ownerId !== ownerId) {
        return false;
      }
    }
    for (const id of ids) {
      this.deleteMindmap(ownerId, id);
    }
    return true;
  }

  listHistory(ownerId: string, mindmapId: number): FakeHistoryRecord[] | undefined {
    const map = this.mindmaps.get(mindmapId);
    if (!map || map.ownerId !== ownerId) {
      return undefined;
    }
    return Array.from(this.mindmapHistory.values())
      .filter((h) => h.mindmapId === mindmapId && h.ownerId === ownerId)
      .sort((a, b) => b.id - a.id)
      .map((h) => ({ ...h }));
  }

  getHistoryEntry(
    ownerId: string,
    mindmapId: number,
    hid: number,
  ): FakeHistoryRecord | undefined {
    const entry = this.mindmapHistory.get(hid);
    if (!entry || entry.ownerId !== ownerId || entry.mindmapId !== mindmapId) {
      return undefined;
    }
    return { ...entry };
  }

  revertHistory(
    ownerId: string,
    ownerEmail: string,
    mindmapId: number,
    hid: number | 'latest',
    ownerName?: string,
  ): FakeMindmapRecord | undefined {
    const map = this.mindmaps.get(mindmapId);
    if (!map || map.ownerId !== ownerId) {
      return undefined;
    }
    const editor = ownerName?.trim() || ownerEmail.split('@')[0] || 'User';
    if (hid === 'latest') {
      const latest = Array.from(this.mindmapHistory.values())
        .filter((h) => h.mindmapId === mindmapId && h.ownerId === ownerId)
        .sort((a, b) => b.id - a.id)[0];
      if (!latest) {
        return { ...map };
      }
      map.xml = latest.xml;
      map.version += 1;
      map.lastModificationBy = editor;
      map.lastModificationTime = new Date().toISOString();
      return { ...map };
    }
    const target = this.mindmapHistory.get(hid);
    if (!target || target.ownerId !== ownerId || target.mindmapId !== mindmapId) {
      return undefined;
    }

    const now = new Date().toISOString();
    map.xml = target.xml;
    map.version += 1;
    map.lastModificationBy = editor;
    map.lastModificationTime = now;

    const newHid = this.nextHistoryId++;
    this.mindmapHistory.set(newHid, {
      id: newHid,
      mindmapId: map.id,
      ownerId,
      xml: target.xml,
      editorName: editor,
      creationTime: now,
    });

    return { ...map };
  }

  createLabel(input: {
    ownerId: string;
    title: string;
    color: string;
    iconName?: string;
    parentLabelId?: number | null;
  }): FakeLabelRecord {
    for (const existing of this.labels.values()) {
      if (existing.ownerId === input.ownerId && existing.title === input.title) {
        throw new FakePgError('23505', `Duplicate label title "${input.title}"`);
      }
    }
    const id = this.nextLabelId++;
    const record: FakeLabelRecord = {
      id,
      ownerId: input.ownerId,
      title: input.title,
      color: input.color,
      iconName: input.iconName ?? 'tag',
      parentLabelId: input.parentLabelId ?? null,
      creationTime: new Date().toISOString(),
    };
    this.labels.set(id, record);
    return { ...record };
  }

  listLabels(ownerId: string): FakeLabelRecord[] {
    return Array.from(this.labels.values())
      .filter((l) => l.ownerId === ownerId)
      .map((l) => ({ ...l }));
  }

  getLabel(ownerId: string, labelId: number): FakeLabelRecord | undefined {
    const lbl = this.labels.get(labelId);
    if (!lbl || lbl.ownerId !== ownerId) {
      return undefined;
    }
    return { ...lbl };
  }

  deleteLabel(ownerId: string, labelId: number): boolean {
    const label = this.labels.get(labelId);
    if (!label || label.ownerId !== ownerId) {
      return false;
    }
    this.labels.delete(labelId);
    for (const key of Array.from(this.mindmapLabels.values())) {
      const parts = key.split(':');
      if (parts[1] === String(labelId) && parts[2] === ownerId) {
        this.mindmapLabels.delete(key);
      }
    }
    return true;
  }

  assignLabelToMap(ownerId: string, mindmapId: number, labelId: number): boolean {
    const map = this.mindmaps.get(mindmapId);
    const label = this.labels.get(labelId);
    if (!map || map.ownerId !== ownerId || !label || label.ownerId !== ownerId) {
      return false;
    }
    this.mindmapLabels.add(this.joinKey(mindmapId, labelId, ownerId));
    return true;
  }

  removeLabelFromMap(ownerId: string, mindmapId: number, labelId: number): boolean {
    const map = this.mindmaps.get(mindmapId);
    if (!map || map.ownerId !== ownerId) {
      return false;
    }
    return this.mindmapLabels.delete(this.joinKey(mindmapId, labelId, ownerId));
  }

  getLabelsForMap(ownerId: string, mindmapId: number): FakeLabelRecord[] {
    const results: FakeLabelRecord[] = [];
    for (const label of this.labels.values()) {
      if (
        label.ownerId === ownerId &&
        this.mindmapLabels.has(this.joinKey(mindmapId, label.id, ownerId))
      ) {
        results.push({ ...label });
      }
    }
    return results;
  }

  countHistoryRows(): number {
    return this.mindmapHistory.size;
  }

  countMindmapLabelRows(): number {
    return this.mindmapLabels.size;
  }

  private joinKey(mindmapId: number, labelId: number, ownerId: string): string {
    return `${mindmapId}:${labelId}:${ownerId}`;
  }

  listFolders(ownerId: string): FakeFolderRecord[] {
    return Array.from(this.folders.values())
      .filter((f) => f.ownerId === ownerId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
      .map((f) => ({ ...f }));
  }

  createFolder(input: { ownerId: string; name: string; parentId?: number | null }): FakeFolderRecord {
    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      const parent = this.folders.get(parentId);
      if (!parent || parent.ownerId !== input.ownerId) {
        throw new FakePgError('23503', 'Parent folder not found');
      }
    }
    for (const existing of this.folders.values()) {
      if (
        existing.ownerId === input.ownerId &&
        existing.parentId === parentId &&
        existing.name === input.name
      ) {
        throw new FakePgError('23505', `Duplicate folder "${input.name}"`);
      }
    }
    const now = new Date().toISOString();
    const record: FakeFolderRecord = {
      id: this.nextFolderId++,
      ownerId: input.ownerId,
      name: input.name,
      parentId,
      creationTime: now,
      updatedTime: now,
    };
    this.folders.set(record.id, record);
    return { ...record };
  }

  updateFolder(input: {
    ownerId: string;
    folderId: number;
    name?: string;
    parentId?: number | null;
  }): FakeFolderRecord | 'not_found' | 'cycle' {
    const record = this.folders.get(input.folderId);
    if (!record || record.ownerId !== input.ownerId) {
      return 'not_found';
    }
    const nextName = input.name !== undefined ? input.name : record.name;
    const nextParentId = input.parentId !== undefined ? input.parentId : record.parentId;
    if (nextParentId !== null) {
      const parent = this.folders.get(nextParentId);
      if (!parent || parent.ownerId !== input.ownerId) {
        return 'not_found';
      }
      const visited = new Set<number>();
      let cur: number | null = nextParentId;
      while (cur !== null && !visited.has(cur)) {
        if (cur === input.folderId) {
          return 'cycle';
        }
        visited.add(cur);
        const f = this.folders.get(cur);
        cur = f && f.ownerId === input.ownerId ? f.parentId : null;
      }
    }
    for (const other of this.folders.values()) {
      if (
        other.ownerId === input.ownerId &&
        other.id !== input.folderId &&
        other.parentId === nextParentId &&
        other.name === nextName
      ) {
        throw new FakePgError('23505', `Duplicate folder "${nextName}"`);
      }
    }
    record.name = nextName;
    record.parentId = nextParentId;
    record.updatedTime = new Date().toISOString();
    this.syncFolderPaths(input.ownerId);
    return { ...record };
  }

  deleteFolder(ownerId: string, folderId: number): boolean {
    const record = this.folders.get(folderId);
    if (!record || record.ownerId !== ownerId) {
      return false;
    }
    const resolveUnique = (base: string, occupied: Set<string>, maxLen: number): string => {
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

    const rootFolderNames = new Set(
      Array.from(this.folders.values())
        .filter((f) => f.ownerId === ownerId && f.parentId === null && f.id !== folderId)
        .map((f) => f.name),
    );
    for (const child of this.folders.values()) {
      if (child.ownerId === ownerId && child.parentId === folderId) {
        const nextName = resolveUnique(child.name, rootFolderNames, 100);
        rootFolderNames.add(nextName);
        child.parentId = null;
        child.name = nextName;
        child.updatedTime = new Date().toISOString();
      }
    }

    const rootMapTitles = new Set(
      Array.from(this.mindmaps.values())
        .filter((m) => m.ownerId === ownerId && m.folderId === null)
        .map((m) => m.title),
    );
    for (const m of this.mindmaps.values()) {
      if (m.ownerId === ownerId && m.folderId === folderId) {
        const nextTitle = resolveUnique(m.title, rootMapTitles, 512);
        rootMapTitles.add(nextTitle);
        m.folderId = null;
        m.folderPath = '';
        m.title = nextTitle;
      }
    }

    this.folders.delete(folderId);
    this.syncFolderPaths(ownerId);
    return true;
  }

  moveMapsToFolder(
    ownerId: string,
    mapIds: number[],
    folderId: number | null,
  ): 'ok' | 'map_not_found' | 'folder_not_found' {
    if (folderId !== null) {
      const folder = this.folders.get(folderId);
      if (!folder || folder.ownerId !== ownerId) {
        return 'folder_not_found';
      }
    }
    const uniqueIds = Array.from(new Set(mapIds));
    for (const id of uniqueIds) {
      const m = this.mindmaps.get(id);
      if (!m || m.ownerId !== ownerId) {
        return 'map_not_found';
      }
    }
    const movingSet = new Set(uniqueIds);
    const occupied = new Set(
      Array.from(this.mindmaps.values())
        .filter((m) => m.ownerId === ownerId && m.folderId === folderId && !movingSet.has(m.id))
        .map((m) => m.title),
    );
    for (const id of uniqueIds) {
      const m = this.mindmaps.get(id)!;
      if (occupied.has(m.title)) {
        throw new FakePgError('23505', m.title);
      }
      occupied.add(m.title);
    }
    const targetPath = this.buildFolderPath(ownerId, folderId);
    for (const id of uniqueIds) {
      const m = this.mindmaps.get(id)!;
      m.folderId = folderId;
      m.folderPath = targetPath;
    }
    return 'ok';
  }
}

export interface FakeOAuthProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
}

export class FakeOAuthAdapter {
  private codeMap = new Map<string, FakeOAuthProfile>();
  private validPkceVerifiers = new Set<string>();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.codeMap.clear();
    this.validPkceVerifiers.clear();
    this.codeMap.set('valid_owner_code', {
      id: DEFAULT_OWNER_UUID,
      email: DEFAULT_ALLOWED_EMAIL,
      emailVerified: true,
      fullName: 'Jian Owner',
    });
    this.codeMap.set('uppercase_owner_code', {
      id: DEFAULT_OWNER_UUID,
      email: 'A.JIAN0629@GMAIL.COM',
      emailVerified: true,
      fullName: 'Jian Owner',
    });
    this.codeMap.set('unverified_owner_code', {
      id: DEFAULT_OWNER_UUID,
      email: DEFAULT_ALLOWED_EMAIL,
      emailVerified: false,
      fullName: 'Unverified Owner',
    });
    this.codeMap.set('attacker_code', {
      id: ATTACKER_UUID,
      email: 'attacker@gmail.com',
      emailVerified: true,
      fullName: 'Attacker',
    });
  }

  registerAuthCode(code: string, profile: FakeOAuthProfile): void {
    this.codeMap.set(code, profile);
  }

  issuePkceSession(redirectTo: string, state?: string): {
    authorizeUrl: string;
    cookieName: string;
    cookieValue: string;
  } {
    const verifier = crypto.randomBytes(16).toString('hex');
    this.validPkceVerifiers.add(verifier);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('redirect_to', redirectTo);
    url.searchParams.set('provider', 'google');
    if (state) {
      url.searchParams.set('state', state);
    }
    return {
      authorizeUrl: url.toString(),
      cookieName: 'sb-e2e-auth-token-code-verifier',
      cookieValue: verifier,
    };
  }

  exchangeCode(
    code: string,
    pkceVerifier?: string,
  ): { ok: true; profile: FakeOAuthProfile } | { ok: false; error: string } {
    if (pkceVerifier !== undefined && !this.validPkceVerifiers.has(pkceVerifier)) {
      return { ok: false, error: 'invalid_pkce_verifier' };
    }
    const profile = this.codeMap.get(code);
    if (!profile) {
      return { ok: false, error: 'invalid_grant' };
    }
    return { ok: true, profile };
  }
}

export interface RepoErrorConstructors {
  NotFoundOrForbiddenError: new (message?: string, errorCode?: string) => Error;
  RepoValidationError: new (
    globalErrors: string[],
    fieldErrors?: Record<string, string>,
    errorCode?: string,
  ) => Error;
  VersionConflictError: new (currentVersion: number) => Error;
}

const DEFAULT_ERROR_CONSTRUCTORS: RepoErrorConstructors = {
  NotFoundOrForbiddenError: class extends Error {
    readonly errorCode: string;
    constructor(message = 'Map could not be found.', errorCode = 'MAP_NOT_FOUND') {
      super(message);
      this.errorCode = errorCode;
    }
  },
  RepoValidationError: class extends Error {
    readonly globalErrors: string[];
    readonly fieldErrors: Record<string, string>;
    readonly errorCode?: string;
    constructor(
      globalErrors: string[],
      fieldErrors: Record<string, string> = {},
      errorCode?: string,
    ) {
      super(globalErrors[0] ?? Object.values(fieldErrors)[0] ?? 'Validation error');
      this.globalErrors = globalErrors;
      this.fieldErrors = fieldErrors;
      this.errorCode = errorCode;
    }
  },
  VersionConflictError: class extends Error {
    readonly currentVersion: number;
    constructor(currentVersion: number) {
      super('Version conflict');
      this.currentVersion = currentVersion;
    }
  },
};

export interface FakeHandlerDeps {
  readonly __isFakeHandlerDeps: true;
  store: FakeStore;
  oauth: FakeOAuthAdapter;
  env: Record<string, string | undefined>;
  repo: ReturnType<typeof createFakeMindmapRepository>;
  createSupabaseClient: ReturnType<typeof createFakeSupabaseClientFactory>;
  oauthDeps: {
    createSupabaseClient: ReturnType<typeof createFakeSupabaseClientFactory>;
  };
  withErrorClasses(classes: RepoErrorConstructors): FakeHandlerDeps;
}

interface RepoUserLike {
  uid: string;
  email: string;
  name: string;
}

export function createFakeMindmapRepository(
  store: FakeStore,
  errors: RepoErrorConstructors = DEFAULT_ERROR_CONSTRUCTORS,
) {
  const toWithLabels = (ownerId: string, m: FakeMindmapRecord) => ({
    id: m.id,
    ownerId: m.ownerId,
    title: m.title,
    description: m.description,
    folderId: m.folderId,
    folderPath: m.folderPath,
    xml: m.xml,
    properties: m.properties,
    starred: m.starred,
    version: m.version,
    lastModificationBy: m.lastModificationBy,
    creationTime: m.creationTime,
    lastModificationTime: m.lastModificationTime,
    labels: store.getLabelsForMap(ownerId, m.id).map((l) => ({
      id: l.id,
      title: l.title,
      color: l.color,
    })),
  });

  return {
    async listMaps(user: RepoUserLike, filter?: string) {
      return store.listMindmaps(user.uid, filter).map((m) => toWithLabels(user.uid, m));
    },

    async createMap(
      user: RepoUserLike,
      input: {
        title: string;
        description: string;
        xml: string;
        properties?: string;
        folderId?: number | null;
        folderPath?: string;
      },
    ) {
      try {
        return store.createMindmap({
          ownerId: user.uid,
          ownerEmail: user.email,
          ownerName: user.name,
          title: input.title,
          description: input.description,
          folderId: input.folderId,
          folderPath: input.folderPath,
          xml: input.xml,
          properties: input.properties,
        });
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23503') {
          throw new errors.NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
        }
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [],
            { title: `A mindmap named "${input.title}" already exists.` },
            'DUPLICATE_MAP_TITLE',
          );
        }
        throw err;
      }
    },

    async getMap(user: RepoUserLike, mapId: number) {
      const m = store.getMindmap(user.uid, mapId);
      if (!m) {
        throw new errors.NotFoundOrForbiddenError();
      }
      return toWithLabels(user.uid, m);
    },

    async getMapXml(user: RepoUserLike, mapId: number) {
      const m = store.getMindmap(user.uid, mapId);
      if (!m) {
        throw new errors.NotFoundOrForbiddenError();
      }
      return { xml: m.xml, version: m.version };
    },

    async updateDocument(
      user: RepoUserLike,
      mapId: number,
      input: { xml: string; properties?: string; minor: boolean; expectedVersion?: number },
    ) {
      const res = store.updateMindmapDocument({
        ownerId: user.uid,
        ownerEmail: user.email,
        ownerName: user.name,
        id: mapId,
        xml: input.xml,
        properties: input.properties,
        minor: input.minor,
        expectedVersion: input.expectedVersion,
      });
      if (res.status === 'not_found') {
        throw new errors.NotFoundOrForbiddenError();
      }
      if (res.status === 'conflict') {
        throw new errors.VersionConflictError(res.currentVersion);
      }
      return {
        version: res.mindmap.version,
        lastModificationTime: res.mindmap.lastModificationTime,
      };
    },

    async updateMap(
      user: RepoUserLike,
      mapId: number,
      input: {
        xml?: string;
        properties?: string;
        title?: string;
        description?: string;
        minor: boolean;
        expectedVersion?: number;
      },
    ) {
      try {
        const res = store.updateMindmapDocument({
          ownerId: user.uid,
          ownerEmail: user.email,
          ownerName: user.name,
          id: mapId,
          xml: input.xml,
          properties: input.properties,
          title: input.title,
          description: input.description,
          minor: input.minor,
          expectedVersion: input.expectedVersion,
        });
        if (res.status === 'not_found') {
          throw new errors.NotFoundOrForbiddenError();
        }
        if (res.status === 'conflict') {
          throw new errors.VersionConflictError(res.currentVersion);
        }
        return {
          version: res.mindmap.version,
          lastModificationTime: res.mindmap.lastModificationTime,
        };
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [],
            { title: `A mindmap named "${input.title ?? ''}" already exists.` },
            'DUPLICATE_MAP_TITLE',
          );
        }
        throw err;
      }
    },

    async updateTitle(user: RepoUserLike, mapId: number, title: string) {
      try {
        const updated = store.updateMindmapTitle(user.uid, mapId, title, user.name);
        if (!updated) {
          throw new errors.NotFoundOrForbiddenError();
        }
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [],
            { title: `A mindmap named "${title}" already exists.` },
            'DUPLICATE_MAP_TITLE',
          );
        }
        throw err;
      }
    },

    async updateDescription(user: RepoUserLike, mapId: number, description: string) {
      const updated = store.updateMindmapDescription(user.uid, mapId, description, user.name);
      if (!updated) {
        throw new errors.NotFoundOrForbiddenError();
      }
    },

    async getStarred(user: RepoUserLike, mapId: number) {
      const m = store.getMindmap(user.uid, mapId);
      if (!m) {
        throw new errors.NotFoundOrForbiddenError();
      }
      return m.starred;
    },

    async updateStarred(user: RepoUserLike, mapId: number, starred: boolean) {
      const updated = store.updateMindmapStarred(user.uid, mapId, starred);
      if (!updated) {
        throw new errors.NotFoundOrForbiddenError();
      }
    },

    async assertMapOwned(user: RepoUserLike, mapId: number) {
      const m = store.getMindmap(user.uid, mapId);
      if (!m) {
        throw new errors.NotFoundOrForbiddenError();
      }
    },

    async duplicateMap(
      user: RepoUserLike,
      sourceMapId: number,
      input: { title: string; description?: string },
    ) {
      try {
        const dup = store.duplicateMindmap(
          user.uid,
          user.email,
          sourceMapId,
          input.title,
          input.description,
          user.name,
        );
        if (!dup) {
          throw new errors.NotFoundOrForbiddenError();
        }
        return dup;
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [],
            { title: `A mindmap named "${input.title}" already exists.` },
            'DUPLICATE_MAP_TITLE',
          );
        }
        throw err;
      }
    },

    async deleteMap(user: RepoUserLike, mapId: number) {
      if (!store.deleteMindmap(user.uid, mapId)) {
        throw new errors.NotFoundOrForbiddenError();
      }
    },

    async deleteMapsBatch(user: RepoUserLike, mapIds: number[]) {
      if (!store.batchDeleteMindmaps(user.uid, mapIds)) {
        throw new errors.NotFoundOrForbiddenError();
      }
    },

    async listHistory(user: RepoUserLike, mapId: number) {
      const list = store.listHistory(user.uid, mapId);
      if (!list) {
        throw new errors.NotFoundOrForbiddenError();
      }
      return list;
    },

    async getHistoryXml(user: RepoUserLike, mapId: number, historyId: number) {
      if (!store.getMindmap(user.uid, mapId)) {
        throw new errors.NotFoundOrForbiddenError();
      }
      const entry = store.getHistoryEntry(user.uid, mapId, historyId);
      if (!entry) {
        throw new errors.RepoValidationError(['History entry could not be found.']);
      }
      return entry.xml;
    },

    async revertHistory(user: RepoUserLike, mapId: number, historyId: number | 'latest') {
      if (!store.getMindmap(user.uid, mapId)) {
        throw new errors.NotFoundOrForbiddenError();
      }
      const reverted = store.revertHistory(user.uid, user.email, mapId, historyId, user.name);
      if (!reverted) {
        throw new errors.RepoValidationError(['History entry could not be found.']);
      }
      return { version: reverted.version };
    },

    async listLabels(user: RepoUserLike) {
      return store.listLabels(user.uid).map((l) => ({
        id: l.id,
        title: l.title,
        color: l.color,
      }));
    },

    async createLabel(
      user: RepoUserLike,
      input: { title: string; color: string; parentLabelId?: number },
    ) {
      try {
        const created = store.createLabel({
          ownerId: user.uid,
          title: input.title,
          color: input.color,
          parentLabelId: input.parentLabelId ?? null,
        });
        return {
          id: created.id,
          title: created.title,
          color: created.color,
        };
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [],
            { title: `A label named "${input.title}" already exists.` },
            'DUPLICATE_LABEL_TITLE',
          );
        }
        throw err;
      }
    },

    async deleteLabel(user: RepoUserLike, labelId: number) {
      if (!store.deleteLabel(user.uid, labelId)) {
        throw new errors.RepoValidationError(['Label could not be found.']);
      }
    },

    async addLabelToMap(user: RepoUserLike, mapId: number, labelId: number) {
      if (!store.getMindmap(user.uid, mapId)) {
        throw new errors.NotFoundOrForbiddenError();
      }
      if (!store.getLabel(user.uid, labelId)) {
        throw new errors.RepoValidationError(['Label could not be found.']);
      }
      store.assignLabelToMap(user.uid, mapId, labelId);
    },

    async removeLabelFromMap(user: RepoUserLike, mapId: number, labelId: number) {
      if (!store.getLabel(user.uid, labelId)) {
        throw new errors.RepoValidationError(['Label could not be found.']);
      }
      if (!store.getMindmap(user.uid, mapId)) {
        throw new errors.NotFoundOrForbiddenError();
      }
      store.removeLabelFromMap(user.uid, mapId, labelId);
    },

    async listFolders(user: RepoUserLike) {
      return store.listFolders(user.uid).map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        creationTime: f.creationTime,
        updatedTime: f.updatedTime,
      }));
    },

    async createFolder(user: RepoUserLike, input: { name: string; parentId?: number | null }) {
      try {
        const f = store.createFolder({
          ownerId: user.uid,
          name: input.name,
          parentId: input.parentId ?? null,
        });
        return {
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          creationTime: f.creationTime,
          updatedTime: f.updatedTime,
        };
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23503') {
          throw new errors.NotFoundOrForbiddenError('Parent folder could not be found.', 'FOLDER_NOT_FOUND');
        }
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [],
            { name: '同级目录下已存在同名文件夹。' },
            'DUPLICATE_FOLDER_NAME',
          );
        }
        throw err;
      }
    },

    async updateFolder(
      user: RepoUserLike,
      folderId: number,
      input: { name?: string; parentId?: number | null },
    ) {
      try {
        const res = store.updateFolder({
          ownerId: user.uid,
          folderId,
          name: input.name,
          parentId: input.parentId,
        });
        if (res === 'not_found') {
          throw new errors.NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
        }
        if (res === 'cycle') {
          throw new errors.RepoValidationError(
            ['不能将文件夹移动到自身或其子文件夹下。'],
            { parentId: '不能将文件夹移动到自身或其子文件夹下。' },
            'FOLDER_CYCLE',
          );
        }
        return {
          id: res.id,
          name: res.name,
          parentId: res.parentId,
          creationTime: res.creationTime,
          updatedTime: res.updatedTime,
        };
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [],
            { name: '同级目录下已存在同名文件夹。' },
            'DUPLICATE_FOLDER_NAME',
          );
        }
        throw err;
      }
    },

    async deleteFolder(user: RepoUserLike, folderId: number) {
      if (!store.deleteFolder(user.uid, folderId)) {
        throw new errors.NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
      }
    },

    async moveMapsToFolder(user: RepoUserLike, mapIds: number[], folderId: number | null) {
      try {
        const res = store.moveMapsToFolder(user.uid, mapIds, folderId);
        if (res === 'folder_not_found') {
          throw new errors.NotFoundOrForbiddenError('Target folder could not be found.', 'FOLDER_NOT_FOUND');
        }
        if (res === 'map_not_found') {
          throw new errors.NotFoundOrForbiddenError();
        }
      } catch (err) {
        if (err instanceof FakePgError && err.code === '23505') {
          throw new errors.RepoValidationError(
            [`目标文件夹中已存在同名导图“${err.message}”。`],
            { title: `目标文件夹中已存在同名导图“${err.message}”。` },
            'DUPLICATE_MAP_TITLE',
          );
        }
        throw err;
      }
    },
  };
}

export function createFakeSupabaseClientFactory(oauth: FakeOAuthAdapter) {
  return (_req: Request, resHeaders: Headers) => ({
    auth: {
      async signInWithOAuth(params: {
        provider: 'google';
        options?: {
          redirectTo?: string;
          skipBrowserRedirect?: boolean;
          queryParams?: Record<string, string>;
        };
      }) {
        const pkce = oauth.issuePkceSession(
          params.options?.redirectTo ?? '',
          params.options?.queryParams?.state,
        );
        resHeaders.append(
          'Set-Cookie',
          `${pkce.cookieName}=${pkce.cookieValue}; Path=/; HttpOnly; SameSite=Lax`,
        );
        return { data: { url: pkce.authorizeUrl }, error: null };
      },

      async exchangeCodeForSession(code: string) {
        const result = oauth.exchangeCode(code);
        if (!result.ok) {
          return {
            data: { user: null, session: null },
            error: new Error(result.error),
          };
        }
        return {
          data: {
            user: {
              id: result.profile.id,
              email: result.profile.email,
              email_confirmed_at: result.profile.emailVerified ? new Date().toISOString() : null,
              user_metadata: {
                email_verified: result.profile.emailVerified,
                full_name: result.profile.fullName,
              },
            },
            session: { access_token: 'e2e-fake-supabase-session' },
          },
          error: null,
        };
      },

      async signOut() {
        return { error: null };
      },
    },
  });
}

/**
 * Bridge creating opaque dependency bundle matching M3's `ApiHandlerDeps` and `OAuthHandlerDeps`.
 */
export function createFakeHandlerDeps(
  store = new FakeStore(),
  oauth = new FakeOAuthAdapter(),
  envOverrides: Record<string, string | undefined> = {},
): FakeHandlerDeps {
  const build = (errorClasses: RepoErrorConstructors): FakeHandlerDeps => {
    const repo = createFakeMindmapRepository(store, errorClasses);
    const createSupabaseClient = createFakeSupabaseClientFactory(oauth);
    return {
      __isFakeHandlerDeps: true,
      store,
      oauth,
      env: {
        ALLOWED_EMAIL: DEFAULT_ALLOWED_EMAIL,
        ...envOverrides,
      },
      repo,
      createSupabaseClient,
      oauthDeps: { createSupabaseClient },
      withErrorClasses: build,
    };
  };

  return build(DEFAULT_ERROR_CONSTRUCTORS);
}
