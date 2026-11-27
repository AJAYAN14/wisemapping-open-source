import type { DbClient, DbUserContext, PoolLike } from './db.js';
import { withUserDb } from './db.js';
import { normalizeFolderPath } from './validators.js';

export interface LabelDto {
  id: number;
  title: string;
  color: string;
}

export interface FolderDto {
  id: number;
  name: string;
  parentId: number | null;
  creationTime: string;
  updatedTime: string;
}

export interface CreateFolderInput {
  name: string;
  parentId?: number | null;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: number | null;
}

export interface MindmapRecord {
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
  lastModificationBy: string;
  creationTime: string;
  lastModificationTime: string;
  lastOpenTime: string;
}

export interface MindmapWithLabels extends MindmapRecord {
  labels: LabelDto[];
}

export interface MindmapHistoryRecord {
  id: number;
  mindmapId: number;
  xml: string;
  editorName: string;
  creationTime: string;
}

export interface CreateMapInput {
  title: string;
  description: string;
  xml: string;
  properties?: string;
  folderId?: number | null;
  folderPath?: string;
  overwrite?: boolean;
}

export interface UpdateDocumentInput {
  xml: string;
  properties?: string;
  minor: boolean;
  expectedVersion?: number;
}

export interface UpdateMapInput {
  xml?: string;
  properties?: string;
  title?: string;
  description?: string;
  minor: boolean;
  expectedVersion?: number;
}

export interface DuplicateMapInput {
  title: string;
  description?: string;
}

export interface CreateLabelInput {
  title: string;
  color: string;
  parentLabelId?: number;
}

export interface RepoUser extends DbUserContext {
  name: string;
}

export class NotFoundOrForbiddenError extends Error {
  readonly errorCode: string;

  constructor(message = 'Map could not be found.', errorCode = 'MAP_NOT_FOUND') {
    super(message);
    this.name = 'NotFoundOrForbiddenError';
    this.errorCode = errorCode;
  }
}

export class RepoValidationError extends Error {
  readonly globalErrors: string[];
  readonly fieldErrors: Record<string, string>;
  readonly errorCode?: string;

  constructor(
    globalErrors: string[],
    fieldErrors: Record<string, string> = {},
    errorCode?: string,
  ) {
    super(globalErrors[0] ?? Object.values(fieldErrors)[0] ?? 'Validation error');
    this.name = 'RepoValidationError';
    this.globalErrors = globalErrors;
    this.fieldErrors = fieldErrors;
    this.errorCode = errorCode;
  }
}

export class VersionConflictError extends Error {
  readonly currentVersion: number;

  constructor(currentVersion: number) {
    super(
      "It's not possible to save your changes because your mind map has been modified. Refresh the page and try again.",
    );
    this.name = 'VersionConflictError';
    this.currentVersion = currentVersion;
  }
}

export interface MindmapRepository {
  listMaps(user: RepoUser, filter?: string): Promise<MindmapWithLabels[]>;
  createMap(user: RepoUser, input: CreateMapInput): Promise<MindmapRecord>;
  getMap(user: RepoUser, mapId: number): Promise<MindmapWithLabels>;
  getMapByPath(user: RepoUser, folderPath: string, title: string): Promise<MindmapWithLabels>;
  getMapXml(user: RepoUser, mapId: number): Promise<{ xml: string; version: number }>;
  touchLastOpenTime?(user: RepoUser, mapId: number): Promise<string>;
  updateDocument(
    user: RepoUser,
    mapId: number,
    input: UpdateDocumentInput,
  ): Promise<{ version: number; lastModificationTime: string }>;
  updateMap(
    user: RepoUser,
    mapId: number,
    input: UpdateMapInput,
  ): Promise<{ version: number; lastModificationTime: string }>;
  updateTitle(user: RepoUser, mapId: number, title: string): Promise<void>;
  updateDescription(user: RepoUser, mapId: number, description: string): Promise<void>;
  getStarred(user: RepoUser, mapId: number): Promise<boolean>;
  updateStarred(user: RepoUser, mapId: number, starred: boolean): Promise<void>;
  assertMapOwned(user: RepoUser, mapId: number): Promise<void>;
  duplicateMap(user: RepoUser, sourceMapId: number, input: DuplicateMapInput): Promise<MindmapRecord>;
  deleteMap(user: RepoUser, mapId: number): Promise<void>;
  deleteMapsBatch(user: RepoUser, mapIds: number[]): Promise<void>;
  listHistory(user: RepoUser, mapId: number): Promise<MindmapHistoryRecord[]>;
  getHistoryXml(user: RepoUser, mapId: number, historyId: number): Promise<string>;
  revertHistory(
    user: RepoUser,
    mapId: number,
    historyId: number | 'latest',
  ): Promise<{ version: number }>;
  listLabels(user: RepoUser): Promise<LabelDto[]>;
  createLabel(user: RepoUser, input: CreateLabelInput): Promise<LabelDto>;
  deleteLabel(user: RepoUser, labelId: number): Promise<void>;
  addLabelToMap(user: RepoUser, mapId: number, labelId: number): Promise<void>;
  removeLabelFromMap(user: RepoUser, mapId: number, labelId: number): Promise<void>;
  listFolders(user: RepoUser): Promise<FolderDto[]>;
  createFolder(user: RepoUser, input: CreateFolderInput): Promise<FolderDto>;
  updateFolder(user: RepoUser, folderId: number, input: UpdateFolderInput): Promise<FolderDto>;
  deleteFolder(user: RepoUser, folderId: number): Promise<void>;
  moveMapsToFolder(user: RepoUser, mapIds: number[], folderId: number | null): Promise<void>;
  listAllXmlForOwner(user: RepoUser): Promise<string[]>;
  getOwnerXmlStats(user: RepoUser): Promise<{
    mapCount: number;
    historyCount: number;
    totalXmlBytes: number;
    mapsWithInlineImages: number;
  }>;
}

interface RawMindmapRow {
  id: string | number;
  owner_id: string;
  title: string;
  description: string | null;
  folder_id?: string | number | null;
  folder_path?: string | null;
  xml: string;
  properties: string;
  starred: boolean;
  version: string | number;
  last_modification_by: string;
  creation_time: Date | string;
  last_modification_time: Date | string;
  last_open_time?: Date | string | null;
}

interface RawFolderRow {
  id: string | number;
  name: string;
  parent_id: string | number | null;
  creation_time: Date | string;
  updated_time: Date | string;
}

interface RawLabelRow {
  id: string | number;
  title: string;
  color: string;
}

interface RawMapLabelRow {
  mindmap_id: string | number;
  id: string | number;
  title: string;
  color: string;
}

interface RawHistoryRow {
  id: string | number;
  mindmap_id: string | number;
  xml: string;
  editor_name: string;
  creation_time: Date | string;
}

function toInt(val: string | number): number {
  return typeof val === 'number' ? val : Number.parseInt(val, 10);
}

function toIso(val: Date | string): string {
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function mapMindmapRow(row: RawMindmapRow): MindmapRecord {
  return {
    id: toInt(row.id),
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? '',
    folderId: row.folder_id !== undefined && row.folder_id !== null ? toInt(row.folder_id) : null,
    folderPath: row.folder_path ?? '',
    xml: row.xml,
    properties: row.properties,
    starred: Boolean(row.starred),
    version: toInt(row.version),
    lastModificationBy: row.last_modification_by,
    creationTime: toIso(row.creation_time),
    lastModificationTime: toIso(row.last_modification_time),
    lastOpenTime: row.last_open_time ? toIso(row.last_open_time) : toIso(row.last_modification_time),
  };
}

function mapFolderRow(row: RawFolderRow): FolderDto {
  return {
    id: toInt(row.id),
    name: row.name,
    parentId: row.parent_id !== null && row.parent_id !== undefined ? toInt(row.parent_id) : null,
    creationTime: toIso(row.creation_time),
    updatedTime: toIso(row.updated_time),
  };
}

function buildFolderPathFromMap(byId: Map<number, FolderDto>, folderId: number | null): string {
  if (folderId === null) {
    return '';
  }
  const parts: string[] = [];
  const visited = new Set<number>();
  let cur: number | null = folderId;
  while (cur !== null && !visited.has(cur)) {
    visited.add(cur);
    const folder = byId.get(cur);
    if (!folder) {
      break;
    }
    parts.unshift(folder.name);
    cur = folder.parentId;
  }
  return parts.length > 0 ? `${parts.join('/')}/` : '';
}

function resolveUniqueName(baseName: string, existingNames: Set<string>, maxLen: number): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }
  let counter = 2;
  while (counter < 10000) {
    const suffix = ` (${counter})`;
    const truncatedBase = baseName.slice(0, Math.max(1, maxLen - suffix.length));
    const candidate = `${truncatedBase}${suffix}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
  return `${baseName.slice(0, Math.max(1, maxLen - 8))}-${Date.now()}`;
}

export class PgMindmapRepository implements MindmapRepository {
  private readonly poolOverride?: PoolLike;

  constructor(poolOverride?: PoolLike) {
    this.poolOverride = poolOverride;
  }

  private runInTx<T>(user: RepoUser, fn: (client: DbClient) => Promise<T>): Promise<T> {
    return withUserDb({ uid: user.uid, email: user.email }, fn, this.poolOverride);
  }

  private async fetchLabelsForMaps(
    client: DbClient,
    ownerId: string,
    mapIds: number[],
  ): Promise<Map<number, LabelDto[]>> {
    const byMap = new Map<number, LabelDto[]>();
    if (mapIds.length === 0) {
      return byMap;
    }

    const res = await client.query<RawMapLabelRow>(
      `SELECT ml.mindmap_id, l.id, l.title, l.color
       FROM public.mindmap_labels ml
       INNER JOIN public.labels l ON l.id = ml.label_id
       WHERE ml.owner_id = $1 AND ml.mindmap_id = ANY($2::bigint[])
       ORDER BY l.id ASC`,
      [ownerId, mapIds],
    );

    for (const row of res.rows) {
      const mId = toInt(row.mindmap_id);
      const list = byMap.get(mId) ?? [];
      list.push({
        id: toInt(row.id),
        title: row.title,
        color: row.color,
      });
      byMap.set(mId, list);
    }
    return byMap;
  }

  private async fetchAllFoldersTx(client: DbClient, ownerId: string): Promise<FolderDto[]> {
    const res = await client.query<RawFolderRow>(
      `SELECT id, name, parent_id, creation_time, updated_time
       FROM public.folders
       WHERE owner_id = $1
       ORDER BY name ASC, id ASC`,
      [ownerId],
    );
    return res.rows.map(mapFolderRow);
  }

  private async syncFolderPathsTx(client: DbClient, ownerId: string): Promise<void> {
    const folders = await this.fetchAllFoldersTx(client, ownerId);
    if (folders.length === 0) {
      await client.query(
        `UPDATE public.mindmaps
         SET folder_path = ''
         WHERE owner_id = $1 AND folder_id IS NULL AND folder_path <> ''`,
        [ownerId],
      );
      return;
    }
    const byId = new Map(folders.map((f) => [f.id, f]));
    const fids: number[] = [];
    const fpaths: string[] = [];
    for (const f of folders) {
      fids.push(f.id);
      fpaths.push(buildFolderPathFromMap(byId, f.id));
    }
    await client.query(
      `UPDATE public.mindmaps AS m
       SET folder_path = v.fpath
       FROM (
         SELECT unnest($1::bigint[]) AS fid,
                unnest($2::text[]) AS fpath
       ) AS v
       WHERE m.owner_id = $3
         AND m.folder_id = v.fid
         AND m.folder_path IS DISTINCT FROM v.fpath`,
      [fids, fpaths, ownerId],
    );
    await client.query(
      `UPDATE public.mindmaps
       SET folder_path = ''
       WHERE owner_id = $1 AND folder_id IS NULL AND folder_path <> ''`,
      [ownerId],
    );
  }

  private async resolveOrCreateFolderPathTx(
    client: DbClient,
    ownerId: string,
    rawPath: string,
  ): Promise<{ folderId: number | null; folderPath: string }> {
    const segments = rawPath
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (segments.length === 0) {
      return { folderId: null, folderPath: '' };
    }
    let parentId: number | null = null;
    const normalizedSegments: string[] = [];
    for (const rawSeg of segments) {
      const seg = rawSeg.slice(0, 100);
      normalizedSegments.push(seg);
      const existing = await client.query<{ id: string | number }>(
        `SELECT id FROM public.folders
         WHERE owner_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3
         LIMIT 1`,
        [ownerId, parentId, seg],
      );
      if (existing.rows[0]) {
        parentId = toInt(existing.rows[0].id);
      } else {
        const inserted = await client.query<{ id: string | number }>(
          `INSERT INTO public.folders (owner_id, name, parent_id)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [ownerId, seg, parentId],
        );
        parentId = toInt(inserted.rows[0]!.id);
      }
    }
    return {
      folderId: parentId,
      folderPath: `${normalizedSegments.join('/')}/`,
    };
  }

  async listMaps(user: RepoUser, filter?: string): Promise<MindmapWithLabels[]> {
    const normalizedFilter = filter?.trim() ?? '';
    if (normalizedFilter === 'shared_with_me' || normalizedFilter === 'public') {
      return [];
    }

    return this.runInTx(user, async (client) => {
      let rows: RawMindmapRow[];

      if (normalizedFilter === '' || normalizedFilter === 'all' || normalizedFilter === 'my_maps') {
        const res = await client.query<RawMindmapRow>(
          `SELECT id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                  last_modification_by, creation_time, last_modification_time, last_open_time
           FROM public.mindmaps
           WHERE owner_id = $1
           ORDER BY last_modification_time DESC, id DESC
           LIMIT 500`,
          [user.uid],
        );
        rows = res.rows;
      } else if (normalizedFilter === 'starred') {
        const res = await client.query<RawMindmapRow>(
          `SELECT id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                  last_modification_by, creation_time, last_modification_time, last_open_time
           FROM public.mindmaps
           WHERE owner_id = $1 AND starred = TRUE
           ORDER BY last_modification_time DESC, id DESC
           LIMIT 500`,
          [user.uid],
        );
        rows = res.rows;
      } else {
        const res = await client.query<RawMindmapRow>(
          `SELECT m.id, m.owner_id, m.title, m.description, m.folder_id, m.folder_path, m.xml, m.properties, m.starred, m.version,
                  m.last_modification_by, m.creation_time, m.last_modification_time, m.last_open_time
           FROM public.mindmaps m
           INNER JOIN public.mindmap_labels ml ON ml.mindmap_id = m.id
           INNER JOIN public.labels l ON l.id = ml.label_id
           WHERE m.owner_id = $1 AND l.owner_id = $1 AND l.title = $2
           ORDER BY m.last_modification_time DESC, m.id DESC
           LIMIT 500`,
          [user.uid, normalizedFilter],
        );
        rows = res.rows;
      }

      const records = rows.map(mapMindmapRow);
      const labelMap = await this.fetchLabelsForMaps(
        client,
        user.uid,
        records.map((r) => r.id),
      );

      return records.map((record) => ({
        ...record,
        labels: labelMap.get(record.id) ?? [],
      }));
    });
  }

  async createMap(user: RepoUser, input: CreateMapInput): Promise<MindmapRecord> {
    return this.runInTx(user, async (client) => {
      let folderId: number | null = input.folderId ?? null;
      let folderPath = '';

      if (folderId !== null) {
        const folders = await this.fetchAllFoldersTx(client, user.uid);
        const byId = new Map(folders.map((f) => [f.id, f]));
        if (!byId.has(folderId)) {
          throw new NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
        }
        folderPath = buildFolderPathFromMap(byId, folderId);
      } else if (input.folderPath?.trim()) {
        const resolved = await this.resolveOrCreateFolderPathTx(client, user.uid, input.folderPath);
        folderId = resolved.folderId;
        folderPath = resolved.folderPath;
      }

      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps
         WHERE owner_id = $1 AND title = $2 AND folder_id IS NOT DISTINCT FROM $3
         LIMIT 1`,
        [user.uid, input.title, folderId],
      );
      if (dup.rows.length > 0) {
        if (!input.overwrite) {
          throw new RepoValidationError(
            [],
            { title: 'You have already a map with the same name' },
            'DUPLICATE_MAP_TITLE',
          );
        }

        const existingId = toInt(dup.rows[0]!.id);
        await client.query(
          `DELETE FROM public.mindmap_history WHERE mindmap_id = $1 AND owner_id = $2`,
          [existingId, user.uid],
        );

        const updatedRes = await client.query<RawMindmapRow>(
          `UPDATE public.mindmaps
           SET xml = $1,
               description = $2,
               properties = COALESCE($3, properties),
               folder_id = $4,
               folder_path = $5,
               last_modification_by = $6,
               last_modification_time = NOW(),
               last_open_time = NOW(),
               version = version + 1
           WHERE id = $7 AND owner_id = $8
           RETURNING id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                     last_modification_by, creation_time, last_modification_time, last_open_time`,
          [
            input.xml,
            input.description,
            input.properties ?? null,
            folderId,
            folderPath,
            user.name,
            existingId,
            user.uid,
          ],
        );
        const updated = updatedRes.rows[0];
        if (!updated) {
          throw new Error('Failed to overwrite mindmap record.');
        }
        return mapMindmapRow(updated);
      }

      const res = await client.query<RawMindmapRow>(
        `INSERT INTO public.mindmaps (
           owner_id, title, description, folder_id, folder_path, xml, properties, starred, version, last_modification_by, last_open_time
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 1, $8, NOW())
         RETURNING id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                   last_modification_by, creation_time, last_modification_time, last_open_time`,
        [
          user.uid,
          input.title,
          input.description,
          folderId,
          folderPath,
          input.xml,
          input.properties ?? '{"zoom":0.8}',
          user.name,
        ],
      );

      const created = res.rows[0];
      if (!created) {
        throw new Error('Failed to create mindmap record.');
      }
      return mapMindmapRow(created);
    });
  }

  private async attachLabelsToMap(
    client: DbClient,
    user: RepoUser,
    row: RawMindmapRow,
  ): Promise<MindmapWithLabels> {
    const record = mapMindmapRow(row);
    const labelMap = await this.fetchLabelsForMaps(client, user.uid, [record.id]);
    return {
      ...record,
      labels: labelMap.get(record.id) ?? [],
    };
  }

  async getMap(user: RepoUser, mapId: number): Promise<MindmapWithLabels> {
    return this.runInTx(user, async (client) => {
      const res = await client.query<RawMindmapRow>(
        `SELECT id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                last_modification_by, creation_time, last_modification_time, last_open_time
         FROM public.mindmaps
         WHERE id = $1 AND owner_id = $2
         LIMIT 1`,
        [mapId, user.uid],
      );
      const row = res.rows[0];
      if (!row) {
        throw new NotFoundOrForbiddenError();
      }
      return this.attachLabelsToMap(client, user, row);
    });
  }

  async getMapByPath(user: RepoUser, folderPath: string, title: string): Promise<MindmapWithLabels> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new NotFoundOrForbiddenError();
    }
    const normalizedPath = normalizeFolderPath(folderPath);
    return this.runInTx(user, async (client) => {
      const res = await client.query<RawMindmapRow>(
        `SELECT id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                last_modification_by, creation_time, last_modification_time, last_open_time
         FROM public.mindmaps
         WHERE owner_id = $1 AND folder_path = $2 AND title = $3
         LIMIT 1`,
        [user.uid, normalizedPath, normalizedTitle],
      );
      const row = res.rows[0];
      if (!row) {
        throw new NotFoundOrForbiddenError();
      }
      return this.attachLabelsToMap(client, user, row);
    });
  }

  async touchLastOpenTime(user: RepoUser, mapId: number): Promise<string> {
    return this.runInTx(user, async (client) => {
      const res = await client.query<{ last_open_time: Date | string }>(
        `UPDATE public.mindmaps
         SET last_open_time = NOW()
         WHERE id = $1 AND owner_id = $2
         RETURNING last_open_time`,
        [mapId, user.uid],
      );
      const row = res.rows[0];
      if (!row) {
        throw new NotFoundOrForbiddenError();
      }
      return toIso(row.last_open_time);
    });
  }

  async getMapXml(user: RepoUser, mapId: number): Promise<{ xml: string; version: number }> {
    return this.runInTx(user, async (client) => {
      const res = await client.query<{ xml: string; version: string | number }>(
        `SELECT xml, version
         FROM public.mindmaps
         WHERE id = $1 AND owner_id = $2
         LIMIT 1`,
        [mapId, user.uid],
      );
      const row = res.rows[0];
      if (!row) {
        throw new NotFoundOrForbiddenError();
      }
      return {
        xml: row.xml,
        version: toInt(row.version),
      };
    });
  }

  async updateDocument(
    user: RepoUser,
    mapId: number,
    input: UpdateDocumentInput,
  ): Promise<{ version: number; lastModificationTime: string }> {
    return this.runInTx(user, async (client) => {
      let updatedRow: { version: string | number; last_modification_time: Date | string } | undefined;

      if (input.expectedVersion !== undefined) {
        const res = await client.query<{
          version: string | number;
          last_modification_time: Date | string;
        }>(
          `UPDATE public.mindmaps
           SET xml = $1,
               properties = COALESCE($2, properties),
               last_modification_by = $3,
               last_modification_time = NOW(),
               version = version + 1
           WHERE id = $4 AND owner_id = $5 AND version = $6
           RETURNING version, last_modification_time`,
          [input.xml, input.properties ?? null, user.name, mapId, user.uid, input.expectedVersion],
        );
        updatedRow = res.rows[0];

        if (!updatedRow) {
          const check = await client.query<{ version: string | number }>(
            `SELECT version FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
            [mapId, user.uid],
          );
          const existing = check.rows[0];
          if (!existing) {
            throw new NotFoundOrForbiddenError();
          }
          throw new VersionConflictError(toInt(existing.version));
        }
      } else {
        const res = await client.query<{
          version: string | number;
          last_modification_time: Date | string;
        }>(
          `UPDATE public.mindmaps
           SET xml = $1,
               properties = COALESCE($2, properties),
               last_modification_by = $3,
               last_modification_time = NOW(),
               version = version + 1
           WHERE id = $4 AND owner_id = $5
           RETURNING version, last_modification_time`,
          [input.xml, input.properties ?? null, user.name, mapId, user.uid],
        );
        updatedRow = res.rows[0];
        if (!updatedRow) {
          throw new NotFoundOrForbiddenError();
        }
      }

      if (!input.minor) {
        await client.query(
          `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name)
           VALUES ($1, $2, $3, $4)`,
          [mapId, user.uid, input.xml, user.name],
        );
      }

      return {
        version: toInt(updatedRow.version),
        lastModificationTime: toIso(updatedRow.last_modification_time),
      };
    });
  }

  async updateMap(
    user: RepoUser,
    mapId: number,
    input: UpdateMapInput,
  ): Promise<{ version: number; lastModificationTime: string }> {
    return this.runInTx(user, async (client) => {
      if (input.title !== undefined) {
        const curRes = await client.query<{ folder_id: string | number | null }>(
          `SELECT folder_id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
          [mapId, user.uid],
        );
        const cur = curRes.rows[0];
        if (!cur) {
          throw new NotFoundOrForbiddenError();
        }
        const curFolderId = cur.folder_id !== null ? toInt(cur.folder_id) : null;
        const dup = await client.query<{ id: string | number }>(
          `SELECT id FROM public.mindmaps
           WHERE owner_id = $1 AND title = $2 AND folder_id IS NOT DISTINCT FROM $3 AND id <> $4
           LIMIT 1`,
          [user.uid, input.title, curFolderId, mapId],
        );
        if (dup.rows.length > 0) {
          throw new RepoValidationError(
            [],
            { title: 'You have already a map with the same name' },
            'DUPLICATE_MAP_TITLE',
          );
        }
      }

      const params: unknown[] = [
        input.xml ?? null,
        input.properties ?? null,
        input.title ?? null,
        input.description ?? null,
        user.name,
        mapId,
        user.uid,
      ];

      let sql = `UPDATE public.mindmaps
         SET xml = COALESCE($1, xml),
             properties = COALESCE($2, properties),
             title = COALESCE($3, title),
             description = COALESCE($4, description),
             last_modification_by = $5,
             last_modification_time = NOW(),
             version = version + 1
         WHERE id = $6 AND owner_id = $7`;

      if (input.expectedVersion !== undefined) {
        params.push(input.expectedVersion);
        sql += ` AND version = $8`;
      }
      sql += ` RETURNING version, last_modification_time, xml`;

      const res = await client.query<{
        version: string | number;
        last_modification_time: Date | string;
        xml: string;
      }>(sql, params);

      const updatedRow = res.rows[0];
      if (!updatedRow) {
        const check = await client.query<{ version: string | number }>(
          `SELECT version FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
          [mapId, user.uid],
        );
        const existing = check.rows[0];
        if (!existing) {
          throw new NotFoundOrForbiddenError();
        }
        throw new VersionConflictError(toInt(existing.version));
      }

      if (!input.minor) {
        await client.query(
          `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name)
           VALUES ($1, $2, $3, $4)`,
          [mapId, user.uid, updatedRow.xml, user.name],
        );
      }

      return {
        version: toInt(updatedRow.version),
        lastModificationTime: toIso(updatedRow.last_modification_time),
      };
    });
  }

  async updateTitle(user: RepoUser, mapId: number, title: string): Promise<void> {
    await this.runInTx(user, async (client) => {
      const exists = await client.query<{ id: string | number; folder_id: string | number | null }>(
        `SELECT id, folder_id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      const current = exists.rows[0];
      if (!current) {
        throw new NotFoundOrForbiddenError();
      }

      const curFolderId = current.folder_id !== null ? toInt(current.folder_id) : null;
      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps
         WHERE owner_id = $1 AND title = $2 AND folder_id IS NOT DISTINCT FROM $3 AND id <> $4
         LIMIT 1`,
        [user.uid, title, curFolderId, mapId],
      );
      if (dup.rows.length > 0) {
        throw new RepoValidationError(
          [],
          { title: 'You have already a map with the same name' },
          'DUPLICATE_MAP_TITLE',
        );
      }

      await client.query(
        `UPDATE public.mindmaps
         SET title = $1, last_modification_by = $2, last_modification_time = NOW()
         WHERE id = $3 AND owner_id = $4`,
        [title, user.name, mapId, user.uid],
      );
    });
  }

  async updateDescription(user: RepoUser, mapId: number, description: string): Promise<void> {
    await this.runInTx(user, async (client) => {
      const res = await client.query<{ id: string | number }>(
        `UPDATE public.mindmaps
         SET description = $1, last_modification_by = $2, last_modification_time = NOW()
         WHERE id = $3 AND owner_id = $4
         RETURNING id`,
        [description, user.name, mapId, user.uid],
      );
      if (res.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }
    });
  }

  async getStarred(user: RepoUser, mapId: number): Promise<boolean> {
    return this.runInTx(user, async (client) => {
      const res = await client.query<{ starred: boolean }>(
        `SELECT starred FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      const row = res.rows[0];
      if (!row) {
        throw new NotFoundOrForbiddenError();
      }
      return Boolean(row.starred);
    });
  }

  async updateStarred(user: RepoUser, mapId: number, starred: boolean): Promise<void> {
    await this.runInTx(user, async (client) => {
      const res = await client.query<{ id: string | number }>(
        `UPDATE public.mindmaps
         SET starred = $1
         WHERE id = $2 AND owner_id = $3
         RETURNING id`,
        [starred, mapId, user.uid],
      );
      if (res.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }
    });
  }

  async assertMapOwned(user: RepoUser, mapId: number): Promise<void> {
    await this.runInTx(user, async (client) => {
      const res = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      if (res.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }
    });
  }

  async duplicateMap(
    user: RepoUser,
    sourceMapId: number,
    input: DuplicateMapInput,
  ): Promise<MindmapRecord> {
    return this.runInTx(user, async (client) => {
      const sourceRes = await client.query<RawMindmapRow>(
        `SELECT id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                last_modification_by, creation_time, last_modification_time, last_open_time
         FROM public.mindmaps
         WHERE id = $1 AND owner_id = $2
         LIMIT 1`,
        [sourceMapId, user.uid],
      );
      const source = sourceRes.rows[0];
      if (!source) {
        throw new NotFoundOrForbiddenError();
      }

      const folderId = source.folder_id !== undefined && source.folder_id !== null ? toInt(source.folder_id) : null;
      const folderPath = source.folder_path ?? '';
      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps
         WHERE owner_id = $1 AND title = $2 AND folder_id IS NOT DISTINCT FROM $3
         LIMIT 1`,
        [user.uid, input.title, folderId],
      );
      if (dup.rows.length > 0) {
        throw new RepoValidationError(
          [],
          { title: 'You have already a map with the same name' },
          'DUPLICATE_MAP_TITLE',
        );
      }

      const insertRes = await client.query<RawMindmapRow>(
        `INSERT INTO public.mindmaps (
           owner_id, title, description, folder_id, folder_path, xml, properties, starred, version, last_modification_by, last_open_time
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 1, $8, NOW())
         RETURNING id, owner_id, title, description, folder_id, folder_path, xml, properties, starred, version,
                   last_modification_by, creation_time, last_modification_time, last_open_time`,
        [
          user.uid,
          input.title,
          input.description ?? source.description ?? '',
          folderId,
          folderPath,
          source.xml,
          source.properties,
          user.name,
        ],
      );
      const created = insertRes.rows[0];
      if (!created) {
        throw new Error('Failed to duplicate mindmap.');
      }
      return mapMindmapRow(created);
    });
  }

  async deleteMap(user: RepoUser, mapId: number): Promise<void> {
    await this.runInTx(user, async (client) => {
      const res = await client.query<{ id: string | number }>(
        `DELETE FROM public.mindmaps WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [mapId, user.uid],
      );
      if (res.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }
    });
  }

  async deleteMapsBatch(user: RepoUser, mapIds: number[]): Promise<void> {
    const uniqueIds = Array.from(new Set(mapIds));
    await this.runInTx(user, async (client) => {
      const found = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE owner_id = $1 AND id = ANY($2::bigint[])`,
        [user.uid, uniqueIds],
      );
      if (found.rows.length !== uniqueIds.length) {
        throw new NotFoundOrForbiddenError('One or more maps could not be found.');
      }
      await client.query(
        `DELETE FROM public.mindmaps WHERE owner_id = $1 AND id = ANY($2::bigint[])`,
        [user.uid, uniqueIds],
      );
    });
  }

  async listHistory(user: RepoUser, mapId: number): Promise<MindmapHistoryRecord[]> {
    return this.runInTx(user, async (client) => {
      const owned = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      if (owned.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }

      const res = await client.query<RawHistoryRow>(
        `SELECT id, mindmap_id, xml, editor_name, creation_time
         FROM public.mindmap_history
         WHERE mindmap_id = $1 AND owner_id = $2
         ORDER BY creation_time DESC, id DESC`,
        [mapId, user.uid],
      );
      return res.rows.map((row) => ({
        id: toInt(row.id),
        mindmapId: toInt(row.mindmap_id),
        xml: row.xml,
        editorName: row.editor_name,
        creationTime: toIso(row.creation_time),
      }));
    });
  }

  async getHistoryXml(user: RepoUser, mapId: number, historyId: number): Promise<string> {
    return this.runInTx(user, async (client) => {
      const owned = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      if (owned.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }

      const res = await client.query<{ xml: string }>(
        `SELECT xml
         FROM public.mindmap_history
         WHERE id = $1 AND mindmap_id = $2 AND owner_id = $3
         LIMIT 1`,
        [historyId, mapId, user.uid],
      );
      const row = res.rows[0];
      if (!row) {
        throw new RepoValidationError(['History entry could not be found.'], {}, 'HISTORY_NOT_FOUND');
      }
      return row.xml;
    });
  }

  async revertHistory(
    user: RepoUser,
    mapId: number,
    historyId: number | 'latest',
  ): Promise<{ version: number }> {
    return this.runInTx(user, async (client) => {
      const mapRes = await client.query<{ version: string | number }>(
        `SELECT version FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      const currentMap = mapRes.rows[0];
      if (!currentMap) {
        throw new NotFoundOrForbiddenError();
      }

      if (historyId === 'latest') {
        const latestRes = await client.query<{ xml: string }>(
          `SELECT xml
           FROM public.mindmap_history
           WHERE mindmap_id = $1 AND owner_id = $2
           ORDER BY creation_time DESC, id DESC
           LIMIT 1`,
          [mapId, user.uid],
        );
        const latest = latestRes.rows[0];
        if (!latest) {
          return { version: toInt(currentMap.version) };
        }
        const upd = await client.query<{ version: string | number }>(
          `UPDATE public.mindmaps
           SET xml = $1, last_modification_by = $2, last_modification_time = NOW(), version = version + 1
           WHERE id = $3 AND owner_id = $4
           RETURNING version`,
          [latest.xml, user.name, mapId, user.uid],
        );
        const updated = upd.rows[0];
        if (!updated) {
          throw new NotFoundOrForbiddenError();
        }
        return { version: toInt(updated.version) };
      }

      const histRes = await client.query<{ xml: string }>(
        `SELECT xml
         FROM public.mindmap_history
         WHERE id = $1 AND mindmap_id = $2 AND owner_id = $3
         LIMIT 1`,
        [historyId, mapId, user.uid],
      );
      const hist = histRes.rows[0];
      if (!hist) {
        throw new RepoValidationError(['History entry could not be found.'], {}, 'HISTORY_NOT_FOUND');
      }

      const upd = await client.query<{ version: string | number }>(
        `UPDATE public.mindmaps
         SET xml = $1, last_modification_by = $2, last_modification_time = NOW(), version = version + 1
         WHERE id = $3 AND owner_id = $4
         RETURNING version`,
        [hist.xml, user.name, mapId, user.uid],
      );
      const updated = upd.rows[0];
      if (!updated) {
        throw new NotFoundOrForbiddenError();
      }

      await client.query(
        `INSERT INTO public.mindmap_history (mindmap_id, owner_id, xml, editor_name)
         VALUES ($1, $2, $3, $4)`,
        [mapId, user.uid, hist.xml, user.name],
      );

      return { version: toInt(updated.version) };
    });
  }

  async listLabels(user: RepoUser): Promise<LabelDto[]> {
    return this.runInTx(user, async (client) => {
      const res = await client.query<RawLabelRow>(
        `SELECT id, title, color
         FROM public.labels
         WHERE owner_id = $1
         ORDER BY id ASC`,
        [user.uid],
      );
      return res.rows.map((row) => ({
        id: toInt(row.id),
        title: row.title,
        color: row.color,
      }));
    });
  }

  async createLabel(user: RepoUser, input: CreateLabelInput): Promise<LabelDto> {
    return this.runInTx(user, async (client) => {
      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.labels WHERE owner_id = $1 AND title = $2 LIMIT 1`,
        [user.uid, input.title],
      );
      if (dup.rows.length > 0) {
        throw new RepoValidationError(
          [],
          { title: 'There is already a label with the same name' },
          'DUPLICATE_LABEL_TITLE',
        );
      }

      const res = await client.query<RawLabelRow>(
        `INSERT INTO public.labels (owner_id, title, color, parent_label_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, color`,
        [user.uid, input.title, input.color, input.parentLabelId ?? null],
      );
      const row = res.rows[0];
      if (!row) {
        throw new Error('Failed to create label.');
      }
      return {
        id: toInt(row.id),
        title: row.title,
        color: row.color,
      };
    });
  }

  async deleteLabel(user: RepoUser, labelId: number): Promise<void> {
    await this.runInTx(user, async (client) => {
      const res = await client.query<{ id: string | number }>(
        `DELETE FROM public.labels WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [labelId, user.uid],
      );
      if (res.rows.length === 0) {
        throw new RepoValidationError(
          ['Label could not be found.'],
          {},
          'LABEL_CAN_NOT_BE_FOUND',
        );
      }
    });
  }

  async addLabelToMap(user: RepoUser, mapId: number, labelId: number): Promise<void> {
    await this.runInTx(user, async (client) => {
      const labelRes = await client.query<{ id: string | number }>(
        `SELECT id FROM public.labels WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [labelId, user.uid],
      );
      if (labelRes.rows.length === 0) {
        throw new RepoValidationError(
          ['Label could not be found.'],
          {},
          'LABEL_CAN_NOT_BE_FOUND',
        );
      }

      const mapRes = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      if (mapRes.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }

      await client.query(
        `INSERT INTO public.mindmap_labels (mindmap_id, label_id, owner_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (mindmap_id, label_id) DO NOTHING`,
        [mapId, labelId, user.uid],
      );
    });
  }

  async removeLabelFromMap(user: RepoUser, mapId: number, labelId: number): Promise<void> {
    await this.runInTx(user, async (client) => {
      const labelRes = await client.query<{ id: string | number }>(
        `SELECT id FROM public.labels WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [labelId, user.uid],
      );
      if (labelRes.rows.length === 0) {
        throw new RepoValidationError(
          ['Label could not be found.'],
          {},
          'LABEL_CAN_NOT_BE_FOUND',
        );
      }

      const mapRes = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      if (mapRes.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }

      await client.query(
        `DELETE FROM public.mindmap_labels
         WHERE mindmap_id = $1 AND label_id = $2 AND owner_id = $3`,
        [mapId, labelId, user.uid],
      );
    });
  }

  async listFolders(user: RepoUser): Promise<FolderDto[]> {
    return this.runInTx(user, async (client) => {
      return this.fetchAllFoldersTx(client, user.uid);
    });
  }

  async createFolder(user: RepoUser, input: CreateFolderInput): Promise<FolderDto> {
    return this.runInTx(user, async (client) => {
      const parentId = input.parentId ?? null;
      if (parentId !== null) {
        const parentRes = await client.query<{ id: string | number }>(
          `SELECT id FROM public.folders WHERE id = $1 AND owner_id = $2 LIMIT 1`,
          [parentId, user.uid],
        );
        if (parentRes.rows.length === 0) {
          throw new NotFoundOrForbiddenError('Parent folder could not be found.', 'FOLDER_NOT_FOUND');
        }
      }

      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.folders
         WHERE owner_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3
         LIMIT 1`,
        [user.uid, parentId, input.name],
      );
      if (dup.rows.length > 0) {
        throw new RepoValidationError(
          [],
          { name: '同级目录下已存在同名文件夹。' },
          'DUPLICATE_FOLDER_NAME',
        );
      }

      const res = await client.query<RawFolderRow>(
        `INSERT INTO public.folders (owner_id, name, parent_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, parent_id, creation_time, updated_time`,
        [user.uid, input.name, parentId],
      );
      const row = res.rows[0];
      if (!row) {
        throw new Error('Failed to create folder.');
      }
      return mapFolderRow(row);
    });
  }

  async updateFolder(
    user: RepoUser,
    folderId: number,
    input: UpdateFolderInput,
  ): Promise<FolderDto> {
    return this.runInTx(user, async (client) => {
      const folders = await this.fetchAllFoldersTx(client, user.uid);
      const byId = new Map(folders.map((f) => [f.id, f]));
      const existing = byId.get(folderId);
      if (!existing) {
        throw new NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
      }

      const nextName = input.name !== undefined ? input.name : existing.name;
      const nextParentId = input.parentId !== undefined ? input.parentId : existing.parentId;

      if (nextParentId !== null) {
        if (!byId.has(nextParentId)) {
          throw new NotFoundOrForbiddenError('Parent folder could not be found.', 'FOLDER_NOT_FOUND');
        }
        // Prevent cycles: walk up from nextParentId and ensure folderId is never reached
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
          cur = byId.get(cur)?.parentId ?? null;
        }
      }

      const dup = folders.find(
        (f) => f.id !== folderId && f.parentId === nextParentId && f.name === nextName,
      );
      if (dup) {
        throw new RepoValidationError(
          [],
          { name: '同级目录下已存在同名文件夹。' },
          'DUPLICATE_FOLDER_NAME',
        );
      }

      const res = await client.query<RawFolderRow>(
        `UPDATE public.folders
         SET name = $1, parent_id = $2, updated_time = NOW()
         WHERE id = $3 AND owner_id = $4
         RETURNING id, name, parent_id, creation_time, updated_time`,
        [nextName, nextParentId, folderId, user.uid],
      );
      const updated = res.rows[0];
      if (!updated) {
        throw new NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
      }

      await this.syncFolderPathsTx(client, user.uid);
      return mapFolderRow(updated);
    });
  }

  async deleteFolder(user: RepoUser, folderId: number): Promise<void> {
    await this.runInTx(user, async (client) => {
      const folders = await this.fetchAllFoldersTx(client, user.uid);
      const target = folders.find((f) => f.id === folderId);
      if (!target) {
        throw new NotFoundOrForbiddenError('Folder could not be found.', 'FOLDER_NOT_FOUND');
      }

      // 1. Move direct child folders back to root, resolving any root folder name collision
      const rootFolderNames = new Set(
        folders.filter((f) => f.parentId === null && f.id !== folderId).map((f) => f.name),
      );
      const childFolders = folders.filter((f) => f.parentId === folderId);
      for (const child of childFolders) {
        const resolvedName = resolveUniqueName(child.name, rootFolderNames, 100);
        rootFolderNames.add(resolvedName);
        await client.query(
          `UPDATE public.folders
           SET parent_id = NULL, name = $1, updated_time = NOW()
           WHERE id = $2 AND owner_id = $3`,
          [resolvedName, child.id, user.uid],
        );
      }

      // 2. Move direct child mindmaps back to root, resolving any root title collision
      const rootMapTitlesRes = await client.query<{ title: string }>(
        `SELECT title FROM public.mindmaps WHERE owner_id = $1 AND folder_id IS NULL`,
        [user.uid],
      );
      const rootMapTitles = new Set(rootMapTitlesRes.rows.map((r) => r.title));
      const childMapsRes = await client.query<{ id: string | number; title: string }>(
        `SELECT id, title FROM public.mindmaps WHERE owner_id = $1 AND folder_id = $2 ORDER BY id ASC`,
        [user.uid, folderId],
      );
      for (const row of childMapsRes.rows) {
        const resolvedTitle = resolveUniqueName(row.title, rootMapTitles, 512);
        rootMapTitles.add(resolvedTitle);
        await client.query(
          `UPDATE public.mindmaps
           SET folder_id = NULL, folder_path = '', title = $1
           WHERE id = $2 AND owner_id = $3`,
          [resolvedTitle, toInt(row.id), user.uid],
        );
      }

      // 3. Delete the folder row itself
      await client.query(
        `DELETE FROM public.folders WHERE id = $1 AND owner_id = $2`,
        [folderId, user.uid],
      );

      // 4. Recompute cached folder_path for any descendant maps under moved child folders
      await this.syncFolderPathsTx(client, user.uid);
    });
  }

  async moveMapsToFolder(
    user: RepoUser,
    mapIds: number[],
    folderId: number | null,
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(mapIds));
    if (uniqueIds.length === 0) {
      return;
    }

    await this.runInTx(user, async (client) => {
      let targetFolderPath = '';
      if (folderId !== null) {
        const folders = await this.fetchAllFoldersTx(client, user.uid);
        const byId = new Map(folders.map((f) => [f.id, f]));
        if (!byId.has(folderId)) {
          throw new NotFoundOrForbiddenError('Target folder could not be found.', 'FOLDER_NOT_FOUND');
        }
        targetFolderPath = buildFolderPathFromMap(byId, folderId);
      }

      const mapsToMoveRes = await client.query<{ id: string | number; title: string }>(
        `SELECT id, title FROM public.mindmaps WHERE owner_id = $1 AND id = ANY($2::bigint[])`,
        [user.uid, uniqueIds],
      );
      if (mapsToMoveRes.rows.length !== uniqueIds.length) {
        throw new NotFoundOrForbiddenError('One or more maps could not be found.');
      }

      const existingTargetRes = await client.query<{ id: string | number; title: string }>(
        `SELECT id, title FROM public.mindmaps
         WHERE owner_id = $1 AND folder_id IS NOT DISTINCT FROM $2`,
        [user.uid, folderId],
      );
      const movingIdSet = new Set(uniqueIds);
      const occupiedTitles = new Set(
        existingTargetRes.rows
          .filter((r) => !movingIdSet.has(toInt(r.id)))
          .map((r) => r.title),
      );

      for (const row of mapsToMoveRes.rows) {
        if (occupiedTitles.has(row.title)) {
          throw new RepoValidationError(
            [`目标文件夹中已存在同名导图“${row.title}”。`],
            { title: `目标文件夹中已存在同名导图“${row.title}”。` },
            'DUPLICATE_MAP_TITLE',
          );
        }
        occupiedTitles.add(row.title);
      }

      await client.query(
        `UPDATE public.mindmaps
         SET folder_id = $1, folder_path = $2
         WHERE owner_id = $3 AND id = ANY($4::bigint[])`,
        [folderId, targetFolderPath, user.uid, uniqueIds],
      );
    });
  }

  async listAllXmlForOwner(user: RepoUser): Promise<string[]> {
    return this.runInTx(user, async (client) => {
      const mapsRes = await client.query<{ xml: string }>(
        `SELECT xml FROM public.mindmaps WHERE owner_id = $1`,
        [user.uid],
      );
      const histRes = await client.query<{ xml: string }>(
        `SELECT xml FROM public.mindmap_history WHERE owner_id = $1`,
        [user.uid],
      );
      return [...mapsRes.rows.map((r) => r.xml), ...histRes.rows.map((r) => r.xml)];
    });
  }

  async getOwnerXmlStats(user: RepoUser): Promise<{
    mapCount: number;
    historyCount: number;
    totalXmlBytes: number;
    mapsWithInlineImages: number;
  }> {
    return this.runInTx(user, async (client) => {
      const res = await client.query<{
        map_count: string | number;
        history_count: string | number;
        total_xml_bytes: string | number;
        maps_with_inline_images: string | number;
      }>(
        `SELECT
           (SELECT count(*) FROM public.mindmaps WHERE owner_id = $1) AS map_count,
           (SELECT count(*) FROM public.mindmap_history WHERE owner_id = $1) AS history_count,
           (
             COALESCE((SELECT sum(octet_length(xml)) FROM public.mindmaps WHERE owner_id = $1), 0)
             + COALESCE((SELECT sum(octet_length(xml)) FROM public.mindmap_history WHERE owner_id = $1), 0)
           ) AS total_xml_bytes,
           (SELECT count(*) FROM public.mindmaps WHERE owner_id = $1 AND xml LIKE '%data:image%') AS maps_with_inline_images`,
        [user.uid],
      );
      const row = res.rows[0];
      return {
        mapCount: toInt(row?.map_count ?? 0),
        historyCount: toInt(row?.history_count ?? 0),
        totalXmlBytes: toInt(row?.total_xml_bytes ?? 0),
        mapsWithInlineImages: toInt(row?.maps_with_inline_images ?? 0),
      };
    });
  }
}
