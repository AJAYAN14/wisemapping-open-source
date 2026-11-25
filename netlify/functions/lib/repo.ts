import type { DbClient, DbUserContext, PoolLike } from './db';
import { withUserDb } from './db';

export interface LabelDto {
  id: number;
  title: string;
  color: string;
}

export interface MindmapRecord {
  id: number;
  ownerId: string;
  title: string;
  description: string;
  folderPath: string;
  xml: string;
  properties: string;
  starred: boolean;
  version: number;
  lastModificationBy: string;
  creationTime: string;
  lastModificationTime: string;
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
  folderPath?: string;
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
  getMapXml(user: RepoUser, mapId: number): Promise<{ xml: string; version: number }>;
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
  folder_path?: string | null;
  xml: string;
  properties: string;
  starred: boolean;
  version: string | number;
  last_modification_by: string;
  creation_time: Date | string;
  last_modification_time: Date | string;
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
    folderPath: row.folder_path ?? '',
    xml: row.xml,
    properties: row.properties,
    starred: Boolean(row.starred),
    version: toInt(row.version),
    lastModificationBy: row.last_modification_by,
    creationTime: toIso(row.creation_time),
    lastModificationTime: toIso(row.last_modification_time),
  };
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

  async listMaps(user: RepoUser, filter?: string): Promise<MindmapWithLabels[]> {
    const normalizedFilter = filter?.trim() ?? '';
    if (normalizedFilter === 'shared_with_me' || normalizedFilter === 'public') {
      return [];
    }

    return this.runInTx(user, async (client) => {
      let rows: RawMindmapRow[];

      if (normalizedFilter === '' || normalizedFilter === 'all' || normalizedFilter === 'my_maps') {
        const res = await client.query<RawMindmapRow>(
          `SELECT id, owner_id, title, description, folder_path, xml, properties, starred, version,
                  last_modification_by, creation_time, last_modification_time
           FROM public.mindmaps
           WHERE owner_id = $1
           ORDER BY last_modification_time DESC, id DESC
           LIMIT 500`,
          [user.uid],
        );
        rows = res.rows;
      } else if (normalizedFilter === 'starred') {
        const res = await client.query<RawMindmapRow>(
          `SELECT id, owner_id, title, description, folder_path, xml, properties, starred, version,
                  last_modification_by, creation_time, last_modification_time
           FROM public.mindmaps
           WHERE owner_id = $1 AND starred = TRUE
           ORDER BY last_modification_time DESC, id DESC
           LIMIT 500`,
          [user.uid],
        );
        rows = res.rows;
      } else {
        const res = await client.query<RawMindmapRow>(
          `SELECT m.id, m.owner_id, m.title, m.description, m.folder_path, m.xml, m.properties, m.starred, m.version,
                  m.last_modification_by, m.creation_time, m.last_modification_time
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
    const folderPath = input.folderPath?.trim() ?? '';
    return this.runInTx(user, async (client) => {
      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE owner_id = $1 AND title = $2 AND folder_path = $3 LIMIT 1`,
        [user.uid, input.title, folderPath],
      );
      if (dup.rows.length > 0) {
        throw new RepoValidationError(
          [],
          { title: 'You have already a map with the same name' },
          'DUPLICATE_MAP_TITLE',
        );
      }

      const res = await client.query<RawMindmapRow>(
        `INSERT INTO public.mindmaps (
           owner_id, title, description, folder_path, xml, properties, starred, version, last_modification_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, 1, $7)
         RETURNING id, owner_id, title, description, folder_path, xml, properties, starred, version,
                   last_modification_by, creation_time, last_modification_time`,
        [
          user.uid,
          input.title,
          input.description,
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

  async getMap(user: RepoUser, mapId: number): Promise<MindmapWithLabels> {
    return this.runInTx(user, async (client) => {
      const res = await client.query<RawMindmapRow>(
        `SELECT id, owner_id, title, description, folder_path, xml, properties, starred, version,
                last_modification_by, creation_time, last_modification_time
         FROM public.mindmaps
         WHERE id = $1 AND owner_id = $2
         LIMIT 1`,
        [mapId, user.uid],
      );
      const row = res.rows[0];
      if (!row) {
        throw new NotFoundOrForbiddenError();
      }
      const record = mapMindmapRow(row);
      const labelMap = await this.fetchLabelsForMaps(client, user.uid, [record.id]);
      return {
        ...record,
        labels: labelMap.get(record.id) ?? [],
      };
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
        const dup = await client.query<{ id: string | number }>(
          `SELECT id FROM public.mindmaps
           WHERE owner_id = $1 AND title = $2 AND id <> $3
           LIMIT 1`,
          [user.uid, input.title, mapId],
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
      const exists = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [mapId, user.uid],
      );
      if (exists.rows.length === 0) {
        throw new NotFoundOrForbiddenError();
      }

      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE owner_id = $1 AND title = $2 AND id <> $3 LIMIT 1`,
        [user.uid, title, mapId],
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
        `SELECT id, owner_id, title, description, folder_path, xml, properties, starred, version,
                last_modification_by, creation_time, last_modification_time
         FROM public.mindmaps
         WHERE id = $1 AND owner_id = $2
         LIMIT 1`,
        [sourceMapId, user.uid],
      );
      const source = sourceRes.rows[0];
      if (!source) {
        throw new NotFoundOrForbiddenError();
      }

      const folderPath = source.folder_path ?? '';
      const dup = await client.query<{ id: string | number }>(
        `SELECT id FROM public.mindmaps WHERE owner_id = $1 AND title = $2 AND folder_path = $3 LIMIT 1`,
        [user.uid, input.title, folderPath],
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
           owner_id, title, description, folder_path, xml, properties, starred, version, last_modification_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, 1, $7)
         RETURNING id, owner_id, title, description, folder_path, xml, properties, starred, version,
                   last_modification_by, creation_time, last_modification_time`,
        [
          user.uid,
          input.title,
          input.description ?? source.description ?? '',
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
