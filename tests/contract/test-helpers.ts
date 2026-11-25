import { SignJWT } from 'jose';
import { JWT_EXPIRATION_SECONDS } from '../../netlify/functions/lib/auth';
import {
  NotFoundOrForbiddenError,
  RepoValidationError,
  VersionConflictError,
} from '../../netlify/functions/lib/repo';
import type {
  CreateFolderInput,
  CreateLabelInput,
  CreateMapInput,
  DuplicateMapInput,
  FolderDto,
  LabelDto,
  MindmapHistoryRecord,
  MindmapRecord,
  MindmapRepository,
  MindmapWithLabels,
  RepoUser,
  UpdateDocumentInput,
  UpdateFolderInput,
  UpdateMapInput,
} from '../../netlify/functions/lib/repo';

export const TEST_JWT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
export const TEST_OWNER_UID = '11111111-2222-4333-8444-555555555555';
export const TEST_OWNER_EMAIL = 'a.jian0629@gmail.com';
export const TEST_OWNER_NAME = 'AJian';

export async function signTestJwt(options?: {
  email?: string;
  uid?: string;
  name?: string;
  secret?: string;
  expOffsetSec?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const email = (options?.email ?? TEST_OWNER_EMAIL).toLowerCase();
  const uid = options?.uid ?? TEST_OWNER_UID;
  const name = options?.name ?? TEST_OWNER_NAME;
  const secret = options?.secret ?? TEST_JWT_SECRET;
  const expOffset = options?.expOffsetSec ?? JWT_EXPIRATION_SECONDS;

  return new SignJWT({ uid, name })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(email)
    .setIssuedAt(now)
    .setExpirationTime(now + expOffset)
    .sign(new TextEncoder().encode(secret));
}

export class InMemoryMindmapRepo implements MindmapRepository {
  private nextMapId = 1;
  private nextHistoryId = 1;
  private nextLabelId = 1;
  private nextFolderId = 1;
  private readonly maps = new Map<number, MindmapRecord>();
  private readonly histories: MindmapHistoryRecord[] = [];
  private readonly labels = new Map<number, { ownerId: string; dto: LabelDto }>();
  private readonly folders = new Map<number, { ownerId: string; dto: FolderDto }>();
  private readonly mapLabels = new Map<number, Set<number>>();

  private buildFolderPath(ownerId: string, folderId: number | null): string {
    if (folderId === null) {
      return '';
    }
    const parts: string[] = [];
    const visited = new Set<number>();
    let cur: number | null = folderId;
    while (cur !== null && !visited.has(cur)) {
      visited.add(cur);
      const entry = this.folders.get(cur);
      if (!entry || entry.ownerId !== ownerId) {
        break;
      }
      parts.unshift(entry.dto.name);
      cur = entry.dto.parentId;
    }
    return parts.length > 0 ? `${parts.join('/')}/` : '';
  }

  private syncFolderPaths(ownerId: string): void {
    for (const m of this.maps.values()) {
      if (m.ownerId === ownerId) {
        m.folderPath = this.buildFolderPath(ownerId, m.folderId);
      }
    }
  }

  private resolveOrCreatePath(ownerId: string, rawPath: string): { folderId: number | null; folderPath: string } {
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
      let found: FolderDto | undefined;
      for (const entry of this.folders.values()) {
        if (entry.ownerId === ownerId && entry.dto.parentId === parentId && entry.dto.name === seg) {
          found = entry.dto;
          break;
        }
      }
      if (found) {
        parentId = found.id;
      } else {
        const now = new Date().toISOString();
        const dto: FolderDto = {
          id: this.nextFolderId++,
          name: seg,
          parentId,
          creationTime: now,
          updatedTime: now,
        };
        this.folders.set(dto.id, { ownerId, dto });
        parentId = dto.id;
      }
    }
    return { folderId: parentId, folderPath: `${normalized.join('/')}/` };
  }

  getHistoryCount(mapId: number): number {
    return this.histories.filter((h) => h.mindmapId === mapId).length;
  }

  private getLabelsForMap(mapId: number): LabelDto[] {
    const labelIds = this.mapLabels.get(mapId);
    if (!labelIds) {
      return [];
    }
    const result: LabelDto[] = [];
    for (const id of labelIds) {
      const entry = this.labels.get(id);
      if (entry) {
        result.push({ ...entry.dto });
      }
    }
    return result.sort((a, b) => a.id - b.id);
  }

  async listMaps(user: RepoUser, filter?: string): Promise<MindmapWithLabels[]> {
    const f = filter?.trim() ?? '';
    if (f === 'shared_with_me' || f === 'public') {
      return [];
    }

    const owned = Array.from(this.maps.values()).filter((m) => m.ownerId === user.uid);
    let filtered: MindmapRecord[];
    if (f === '' || f === 'all' || f === 'my_maps') {
      filtered = owned;
    } else if (f === 'starred') {
      filtered = owned.filter((m) => m.starred);
    } else {
      filtered = owned.filter((m) =>
        this.getLabelsForMap(m.id).some((lbl) => lbl.title === f),
      );
    }

    return filtered
      .sort((a, b) => b.id - a.id)
      .map((m) => ({
        ...m,
        labels: this.getLabelsForMap(m.id),
      }));
  }

  async createMap(user: RepoUser, input: CreateMapInput): Promise<MindmapRecord> {
    let folderId: number | null = input.folderId ?? null;
    let folderPath = '';
    if (folderId !== null) {
      const folderEntry = this.folders.get(folderId);
      if (!folderEntry || folderEntry.ownerId !== user.uid) {
        throw new NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
      }
      folderPath = this.buildFolderPath(user.uid, folderId);
    } else if (input.folderPath?.trim()) {
      const resolved = this.resolveOrCreatePath(user.uid, input.folderPath);
      folderId = resolved.folderId;
      folderPath = resolved.folderPath;
    }

    for (const existing of this.maps.values()) {
      if (
        existing.ownerId === user.uid &&
        existing.title === input.title &&
        existing.folderId === folderId
      ) {
        if (!input.overwrite) {
          throw new RepoValidationError(
            [],
            { title: 'You have already a map with the same name' },
            'DUPLICATE_MAP_TITLE',
          );
        }
        const now = new Date().toISOString();
        const updated: MindmapRecord = {
          ...existing,
          description: input.description,
          folderId,
          folderPath,
          xml: input.xml,
          properties: input.properties ?? existing.properties,
          version: existing.version + 1,
          lastModificationBy: user.name,
          lastModificationTime: now,
        };
        this.maps.set(existing.id, updated);
        for (let i = this.histories.length - 1; i >= 0; i -= 1) {
          if (this.histories[i]?.mindmapId === existing.id) {
            this.histories.splice(i, 1);
          }
        }
        return { ...updated };
      }
    }
    const now = new Date().toISOString();
    const record: MindmapRecord = {
      id: this.nextMapId++,
      ownerId: user.uid,
      title: input.title,
      description: input.description,
      folderId,
      folderPath,
      xml: input.xml,
      properties: input.properties ?? '{"zoom":0.8}',
      starred: false,
      version: 1,
      lastModificationBy: user.name,
      creationTime: now,
      lastModificationTime: now,
    };
    this.maps.set(record.id, record);
    return { ...record };
  }

  async getMap(user: RepoUser, mapId: number): Promise<MindmapWithLabels> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    return { ...map, labels: this.getLabelsForMap(mapId) };
  }

  async getMapXml(user: RepoUser, mapId: number): Promise<{ xml: string; version: number }> {
    const map = await this.getMap(user, mapId);
    return { xml: map.xml, version: map.version };
  }

  async updateDocument(
    user: RepoUser,
    mapId: number,
    input: UpdateDocumentInput,
  ): Promise<{ version: number; lastModificationTime: string }> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    if (input.expectedVersion !== undefined && map.version !== input.expectedVersion) {
      throw new VersionConflictError(map.version);
    }
    map.xml = input.xml;
    if (input.properties !== undefined) {
      map.properties = input.properties;
    }
    map.version += 1;
    map.lastModificationBy = user.name;
    map.lastModificationTime = new Date().toISOString();

    if (!input.minor) {
      this.histories.push({
        id: this.nextHistoryId++,
        mindmapId: mapId,
        xml: input.xml,
        editorName: user.name,
        creationTime: new Date().toISOString(),
      });
    }

    return { version: map.version, lastModificationTime: map.lastModificationTime };
  }

  async updateMap(
    user: RepoUser,
    mapId: number,
    input: UpdateMapInput,
  ): Promise<{ version: number; lastModificationTime: string }> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    if (input.title !== undefined) {
      for (const existing of this.maps.values()) {
        if (
          existing.ownerId === user.uid &&
          existing.id !== mapId &&
          existing.folderId === map.folderId &&
          existing.title === input.title
        ) {
          throw new RepoValidationError(
            [],
            { title: 'You have already a map with the same name' },
            'DUPLICATE_MAP_TITLE',
          );
        }
      }
    }
    if (input.expectedVersion !== undefined && map.version !== input.expectedVersion) {
      throw new VersionConflictError(map.version);
    }
    if (input.xml !== undefined) {
      map.xml = input.xml;
    }
    if (input.properties !== undefined) {
      map.properties = input.properties;
    }
    if (input.title !== undefined) {
      map.title = input.title;
    }
    if (input.description !== undefined) {
      map.description = input.description;
    }
    map.version += 1;
    map.lastModificationBy = user.name;
    map.lastModificationTime = new Date().toISOString();

    if (!input.minor) {
      this.histories.push({
        id: this.nextHistoryId++,
        mindmapId: mapId,
        xml: map.xml,
        editorName: user.name,
        creationTime: new Date().toISOString(),
      });
    }
    return { version: map.version, lastModificationTime: map.lastModificationTime };
  }

  async updateTitle(user: RepoUser, mapId: number, title: string): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    for (const existing of this.maps.values()) {
      if (
        existing.ownerId === user.uid &&
        existing.id !== mapId &&
        existing.folderId === map.folderId &&
        existing.title === title
      ) {
        throw new RepoValidationError(
          [],
          { title: 'You have already a map with the same name' },
          'DUPLICATE_MAP_TITLE',
        );
      }
    }
    map.title = title;
    map.lastModificationBy = user.name;
    map.lastModificationTime = new Date().toISOString();
  }

  async updateDescription(user: RepoUser, mapId: number, description: string): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    map.description = description;
    map.lastModificationBy = user.name;
    map.lastModificationTime = new Date().toISOString();
  }

  async getStarred(user: RepoUser, mapId: number): Promise<boolean> {
    const map = await this.getMap(user, mapId);
    return map.starred;
  }

  async updateStarred(user: RepoUser, mapId: number, starred: boolean): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    map.starred = starred;
  }

  async assertMapOwned(user: RepoUser, mapId: number): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
  }

  async duplicateMap(
    user: RepoUser,
    sourceMapId: number,
    input: DuplicateMapInput,
  ): Promise<MindmapRecord> {
    const source = this.maps.get(sourceMapId);
    if (!source || source.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    return this.createMap(user, {
      title: input.title,
      description: input.description ?? source.description,
      folderId: source.folderId,
      xml: source.xml,
      properties: source.properties,
    });
  }

  async deleteMap(user: RepoUser, mapId: number): Promise<void> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    this.maps.delete(mapId);
    this.mapLabels.delete(mapId);
  }

  async deleteMapsBatch(user: RepoUser, mapIds: number[]): Promise<void> {
    const unique = Array.from(new Set(mapIds));
    for (const id of unique) {
      await this.assertMapOwned(user, id);
    }
    for (const id of unique) {
      await this.deleteMap(user, id);
    }
  }

  async listHistory(user: RepoUser, mapId: number): Promise<MindmapHistoryRecord[]> {
    await this.assertMapOwned(user, mapId);
    return this.histories
      .filter((h) => h.mindmapId === mapId)
      .sort((a, b) => b.id - a.id)
      .map((h) => ({ ...h }));
  }

  async getHistoryXml(user: RepoUser, mapId: number, historyId: number): Promise<string> {
    await this.assertMapOwned(user, mapId);
    const entry = this.histories.find((h) => h.id === historyId && h.mindmapId === mapId);
    if (!entry) {
      throw new RepoValidationError(['History entry could not be found.'], {}, 'HISTORY_NOT_FOUND');
    }
    return entry.xml;
  }

  async revertHistory(
    user: RepoUser,
    mapId: number,
    historyId: number | 'latest',
  ): Promise<{ version: number }> {
    const map = this.maps.get(mapId);
    if (!map || map.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError();
    }
    if (historyId === 'latest') {
      const latest = this.histories
        .filter((h) => h.mindmapId === mapId)
        .sort((a, b) => b.id - a.id)[0];
      if (!latest) {
        return { version: map.version };
      }
      map.xml = latest.xml;
      map.version += 1;
      map.lastModificationBy = user.name;
      map.lastModificationTime = new Date().toISOString();
      return { version: map.version };
    }

    const entry = this.histories.find((h) => h.id === historyId && h.mindmapId === mapId);
    if (!entry) {
      throw new RepoValidationError(['History entry could not be found.'], {}, 'HISTORY_NOT_FOUND');
    }
    map.xml = entry.xml;
    map.version += 1;
    map.lastModificationBy = user.name;
    map.lastModificationTime = new Date().toISOString();
    this.histories.push({
      id: this.nextHistoryId++,
      mindmapId: mapId,
      xml: entry.xml,
      editorName: user.name,
      creationTime: new Date().toISOString(),
    });
    return { version: map.version };
  }

  async listLabels(user: RepoUser): Promise<LabelDto[]> {
    return Array.from(this.labels.values())
      .filter((entry) => entry.ownerId === user.uid)
      .map((entry) => ({ ...entry.dto }))
      .sort((a, b) => a.id - b.id);
  }

  async createLabel(user: RepoUser, input: CreateLabelInput): Promise<LabelDto> {
    for (const entry of this.labels.values()) {
      if (entry.ownerId === user.uid && entry.dto.title === input.title) {
        throw new RepoValidationError(
          [],
          { title: 'There is already a label with the same name' },
          'DUPLICATE_LABEL_TITLE',
        );
      }
    }
    const dto: LabelDto = {
      id: this.nextLabelId++,
      title: input.title,
      color: input.color,
    };
    this.labels.set(dto.id, { ownerId: user.uid, dto });
    return { ...dto };
  }

  async deleteLabel(user: RepoUser, labelId: number): Promise<void> {
    const entry = this.labels.get(labelId);
    if (!entry || entry.ownerId !== user.uid) {
      throw new RepoValidationError(['Label could not be found.'], {}, 'LABEL_CAN_NOT_BE_FOUND');
    }
    this.labels.delete(labelId);
    for (const set of this.mapLabels.values()) {
      set.delete(labelId);
    }
  }

  async addLabelToMap(user: RepoUser, mapId: number, labelId: number): Promise<void> {
    const entry = this.labels.get(labelId);
    if (!entry || entry.ownerId !== user.uid) {
      throw new RepoValidationError(['Label could not be found.'], {}, 'LABEL_CAN_NOT_BE_FOUND');
    }
    await this.assertMapOwned(user, mapId);
    const set = this.mapLabels.get(mapId) ?? new Set<number>();
    set.add(labelId);
    this.mapLabels.set(mapId, set);
  }

  async removeLabelFromMap(user: RepoUser, mapId: number, labelId: number): Promise<void> {
    const entry = this.labels.get(labelId);
    if (!entry || entry.ownerId !== user.uid) {
      throw new RepoValidationError(['Label could not be found.'], {}, 'LABEL_CAN_NOT_BE_FOUND');
    }
    await this.assertMapOwned(user, mapId);
    this.mapLabels.get(mapId)?.delete(labelId);
  }

  async listFolders(user: RepoUser): Promise<FolderDto[]> {
    return Array.from(this.folders.values())
      .filter((entry) => entry.ownerId === user.uid)
      .map((entry) => ({ ...entry.dto }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  }

  async createFolder(user: RepoUser, input: CreateFolderInput): Promise<FolderDto> {
    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      const parent = this.folders.get(parentId);
      if (!parent || parent.ownerId !== user.uid) {
        throw new NotFoundOrForbiddenError('Parent folder could not be found.', 'FOLDER_NOT_FOUND');
      }
    }
    for (const entry of this.folders.values()) {
      if (entry.ownerId === user.uid && entry.dto.parentId === parentId && entry.dto.name === input.name) {
        throw new RepoValidationError(
          [],
          { name: '同级目录下已存在同名文件夹。' },
          'DUPLICATE_FOLDER_NAME',
        );
      }
    }
    const now = new Date().toISOString();
    const dto: FolderDto = {
      id: this.nextFolderId++,
      name: input.name,
      parentId,
      creationTime: now,
      updatedTime: now,
    };
    this.folders.set(dto.id, { ownerId: user.uid, dto });
    return { ...dto };
  }

  async updateFolder(user: RepoUser, folderId: number, input: UpdateFolderInput): Promise<FolderDto> {
    const entry = this.folders.get(folderId);
    if (!entry || entry.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
    }
    const nextName = input.name !== undefined ? input.name : entry.dto.name;
    const nextParentId = input.parentId !== undefined ? input.parentId : entry.dto.parentId;
    if (nextParentId !== null) {
      const parent = this.folders.get(nextParentId);
      if (!parent || parent.ownerId !== user.uid) {
        throw new NotFoundOrForbiddenError('Parent folder could not be found.', 'FOLDER_NOT_FOUND');
      }
      const visited = new Set<number>();
      let cur: number | null = nextParentId;
      while (cur !== null && !visited.has(cur)) {
        if (cur === folderId) {
          throw new RepoValidationError(
            ['不能将文件夹移动到自身或其子文件夹下。'],
            { parentId: '不能将文件夹移动到自身或其子文件夹下。' },
            'FOLDER_CYCLE',
          );
        }
        visited.add(cur);
        const curEntry = this.folders.get(cur);
        cur = curEntry?.ownerId === user.uid ? curEntry.dto.parentId : null;
      }
    }
    for (const other of this.folders.values()) {
      if (
        other.ownerId === user.uid &&
        other.dto.id !== folderId &&
        other.dto.parentId === nextParentId &&
        other.dto.name === nextName
      ) {
        throw new RepoValidationError(
          [],
          { name: '同级目录下已存在同名文件夹。' },
          'DUPLICATE_FOLDER_NAME',
        );
      }
    }
    entry.dto = {
      ...entry.dto,
      name: nextName,
      parentId: nextParentId,
      updatedTime: new Date().toISOString(),
    };
    this.syncFolderPaths(user.uid);
    return { ...entry.dto };
  }

  async deleteFolder(user: RepoUser, folderId: number): Promise<void> {
    const entry = this.folders.get(folderId);
    if (!entry || entry.ownerId !== user.uid) {
      throw new NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
    }
    const resolveUnique = (base: string, occupied: Set<string>, maxLen: number): string => {
      if (!occupied.has(base)) {
        return base;
      }
      let n = 2;
      while (occupied.has(`${base.slice(0, Math.max(1, maxLen - ` (${n})`.length))} (${n})`)) {
        n += 1;
      }
      const suffix = ` (${n})`;
      return `${base.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`;
    };

    const rootFolderNames = new Set(
      Array.from(this.folders.values())
        .filter((f) => f.ownerId === user.uid && f.dto.parentId === null && f.dto.id !== folderId)
        .map((f) => f.dto.name),
    );
    for (const child of this.folders.values()) {
      if (child.ownerId === user.uid && child.dto.parentId === folderId) {
        const nextName = resolveUnique(child.dto.name, rootFolderNames, 100);
        rootFolderNames.add(nextName);
        child.dto = { ...child.dto, parentId: null, name: nextName, updatedTime: new Date().toISOString() };
      }
    }

    const rootMapTitles = new Set(
      Array.from(this.maps.values())
        .filter((m) => m.ownerId === user.uid && m.folderId === null)
        .map((m) => m.title),
    );
    for (const m of this.maps.values()) {
      if (m.ownerId === user.uid && m.folderId === folderId) {
        const nextTitle = resolveUnique(m.title, rootMapTitles, 512);
        rootMapTitles.add(nextTitle);
        m.folderId = null;
        m.folderPath = '';
        m.title = nextTitle;
      }
    }

    this.folders.delete(folderId);
    this.syncFolderPaths(user.uid);
  }

  async moveMapsToFolder(user: RepoUser, mapIds: number[], folderId: number | null): Promise<void> {
    const uniqueIds = Array.from(new Set(mapIds));
    if (uniqueIds.length === 0) {
      return;
    }
    let targetPath = '';
    if (folderId !== null) {
      const folder = this.folders.get(folderId);
      if (!folder || folder.ownerId !== user.uid) {
        throw new NotFoundOrForbiddenError('Target folder could not be found.', 'FOLDER_NOT_FOUND');
      }
      targetPath = this.buildFolderPath(user.uid, folderId);
    }

    for (const id of uniqueIds) {
      await this.assertMapOwned(user, id);
    }
    const movingSet = new Set(uniqueIds);
    const occupied = new Set(
      Array.from(this.maps.values())
        .filter((m) => m.ownerId === user.uid && m.folderId === folderId && !movingSet.has(m.id))
        .map((m) => m.title),
    );
    for (const id of uniqueIds) {
      const m = this.maps.get(id)!;
      if (occupied.has(m.title)) {
        throw new RepoValidationError(
          [`目标文件夹中已存在同名导图“${m.title}”。`],
          { title: `目标文件夹中已存在同名导图“${m.title}”。` },
          'DUPLICATE_MAP_TITLE',
        );
      }
      occupied.add(m.title);
    }
    for (const id of uniqueIds) {
      const m = this.maps.get(id)!;
      m.folderId = folderId;
      m.folderPath = targetPath;
    }
  }

  async listAllXmlForOwner(user: RepoUser): Promise<string[]> {
    const mapXmls = Array.from(this.maps.values())
      .filter((m) => m.ownerId === user.uid)
      .map((m) => m.xml);
    const ownedMapIds = new Set(
      Array.from(this.maps.values())
        .filter((m) => m.ownerId === user.uid)
        .map((m) => m.id),
    );
    const histXmls = this.histories
      .filter((h) => ownedMapIds.has(h.mindmapId))
      .map((h) => h.xml);
    return [...mapXmls, ...histXmls];
  }

  async getOwnerXmlStats(user: RepoUser): Promise<{
    mapCount: number;
    historyCount: number;
    totalXmlBytes: number;
    mapsWithInlineImages: number;
  }> {
    const ownedMaps = Array.from(this.maps.values()).filter((m) => m.ownerId === user.uid);
    const ownedIds = new Set(ownedMaps.map((m) => m.id));
    const ownedHist = this.histories.filter((h) => ownedIds.has(h.mindmapId));
    let totalXmlBytes = 0;
    let mapsWithInlineImages = 0;
    for (const m of ownedMaps) {
      totalXmlBytes += Buffer.byteLength(m.xml, 'utf8');
      if (m.xml.includes('data:image')) {
        mapsWithInlineImages += 1;
      }
    }
    for (const h of ownedHist) {
      totalXmlBytes += Buffer.byteLength(h.xml, 'utf8');
    }
    return {
      mapCount: ownedMaps.length,
      historyCount: ownedHist.length,
      totalXmlBytes,
      mapsWithInlineImages,
    };
  }
}
