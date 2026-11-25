import { SignJWT } from 'jose';
import { JWT_EXPIRATION_SECONDS } from '../../netlify/functions/lib/auth';
import {
  NotFoundOrForbiddenError,
  RepoValidationError,
  VersionConflictError,
} from '../../netlify/functions/lib/repo';
import type {
  CreateLabelInput,
  CreateMapInput,
  DuplicateMapInput,
  LabelDto,
  MindmapHistoryRecord,
  MindmapRecord,
  MindmapRepository,
  MindmapWithLabels,
  RepoUser,
  UpdateDocumentInput,
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
  private readonly maps = new Map<number, MindmapRecord>();
  private readonly histories: MindmapHistoryRecord[] = [];
  private readonly labels = new Map<number, { ownerId: string; dto: LabelDto }>();
  private readonly mapLabels = new Map<number, Set<number>>();

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
    const folderPath = input.folderPath?.trim() ?? '';
    for (const existing of this.maps.values()) {
      if (
        existing.ownerId === user.uid &&
        existing.title === input.title &&
        (existing.folderPath ?? '') === folderPath
      ) {
        throw new RepoValidationError(
          [],
          { title: 'You have already a map with the same name' },
          'DUPLICATE_MAP_TITLE',
        );
      }
    }
    const now = new Date().toISOString();
    const record: MindmapRecord = {
      id: this.nextMapId++,
      ownerId: user.uid,
      title: input.title,
      description: input.description,
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
        if (existing.ownerId === user.uid && existing.id !== mapId && existing.title === input.title) {
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
      if (existing.ownerId === user.uid && existing.id !== mapId && existing.title === title) {
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
}
