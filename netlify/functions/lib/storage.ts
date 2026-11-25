import { StorageClient } from '@supabase/storage-js';
import { getSupabaseServiceRoleConfig } from './env';

export const MAP_ASSETS_BUCKET = 'map-assets';
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BATCH = 100;

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

const MIME_EXTENSION_MAP: ReadonlyMap<string, string> = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
]);

export interface UploadUrlRequestItem {
  sha256: string;
  mimeType: string;
  size?: number;
}

export interface IssuedUploadUrlItem {
  sha256: string;
  objectPath: string;
  publicUrl: string;
  exists: boolean;
  signedUrl?: string;
  token?: string;
}

export interface StorageUsageSummary {
  bucket: string;
  objectCount: number;
  totalBytes: number;
  configured: boolean;
}

export interface CleanupOrphansResult {
  scannedCount: number;
  deletedCount: number;
  freedBytes: number;
}

export class StorageValidationError extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode = 'INVALID_ASSET_REQUEST') {
    super(message);
    this.name = 'StorageValidationError';
    this.errorCode = errorCode;
  }
}

export class StorageConfigurationError extends Error {
  readonly errorCode = 'STORAGE_NOT_CONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

export interface AssetStorageService {
  issueSignedUploadUrls(
    ownerUid: string,
    items: UploadUrlRequestItem[],
  ): Promise<IssuedUploadUrlItem[]>;
  getStorageUsage(ownerUid: string): Promise<StorageUsageSummary>;
  cleanupOrphanedAssets(
    ownerUid: string,
    referencedPaths: ReadonlySet<string>,
  ): Promise<CleanupOrphansResult>;
}

export function extensionForImageMime(mimeType: string): string | undefined {
  return MIME_EXTENSION_MAP.get(mimeType.trim().toLowerCase());
}

/**
 * Extracts object paths (relative to the bucket, e.g. `<uid>/<sha256>.webp`)
 * referenced inside mindmap XML strings via `/storage/v1/object/public/<bucket>/...`.
 */
export function extractReferencedAssetPaths(
  xmls: readonly string[],
  bucket = MAP_ASSETS_BUCKET,
): Set<string> {
  const escapedBucket = bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `/storage/v1/object/public/${escapedBucket}/([^\\s"'<>?#]+)`,
    'g',
  );
  const refs = new Set<string>();
  for (const xml of xmls) {
    if (!xml) {
      continue;
    }
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) {
      const rawPath = match[1];
      if (!rawPath) {
        continue;
      }
      try {
        refs.add(decodeURIComponent(rawPath));
      } catch {
        refs.add(rawPath);
      }
    }
  }
  return refs;
}

export function validateUploadRequestItems(
  rawItems: unknown,
): Array<{ sha256: string; mimeType: string; ext: string }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new StorageValidationError('Field "items" must be a non-empty array.');
  }
  if (rawItems.length > MAX_UPLOAD_BATCH) {
    throw new StorageValidationError(
      `Cannot request more than ${MAX_UPLOAD_BATCH} upload URLs per batch.`,
    );
  }

  const normalized: Array<{ sha256: string; mimeType: string; ext: string }> = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') {
      throw new StorageValidationError('Each upload item must be an object.');
    }
    const candidate = item as Record<string, unknown>;
    const sha256 = typeof candidate['sha256'] === 'string' ? candidate['sha256'].trim().toLowerCase() : '';
    if (!SHA256_HEX_REGEX.test(sha256)) {
      throw new StorageValidationError('Invalid sha256 digest: expected 64 hex characters.');
    }

    const mimeType =
      typeof candidate['mimeType'] === 'string' ? candidate['mimeType'].trim().toLowerCase() : '';
    const ext = extensionForImageMime(mimeType);
    if (!ext) {
      throw new StorageValidationError(`Unsupported image MIME type: "${mimeType || 'empty'}".`);
    }

    if (candidate['size'] !== undefined && candidate['size'] !== null) {
      if (
        typeof candidate['size'] !== 'number' ||
        !Number.isFinite(candidate['size']) ||
        candidate['size'] <= 0
      ) {
        throw new StorageValidationError('Asset size must be a positive number.');
      }
      if (candidate['size'] > MAX_ASSET_BYTES) {
        throw new StorageValidationError(
          `Image exceeds the ${MAX_ASSET_BYTES / (1024 * 1024)} MB per-asset limit.`,
          'ASSET_TOO_LARGE',
        );
      }
    }

    const dedupeKey = `${sha256}.${ext}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      normalized.push({ sha256, mimeType, ext });
    }
  }

  return normalized;
}

interface StoredFileEntry {
  objectPath: string;
  size: number;
}

export class SupabaseAssetStorageService implements AssetStorageService {
  private readonly storage: StorageClient;
  private readonly bucket: string;

  constructor(storage: StorageClient, bucket = MAP_ASSETS_BUCKET) {
    this.storage = storage;
    this.bucket = bucket;
  }

  private async listOwnerObjects(ownerUid: string): Promise<StoredFileEntry[]> {
    const entries: StoredFileEntry[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.storage.from(this.bucket).list(ownerUid, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error) {
        throw new Error(`Failed to list storage objects: ${error.message}`);
      }
      if (!data || data.length === 0) {
        break;
      }

      for (const obj of data) {
        if (!obj.name || obj.id === null) {
          continue;
        }
        const rawSize = obj.metadata?.['size'];
        const size = typeof rawSize === 'number' && Number.isFinite(rawSize) ? rawSize : 0;
        entries.push({
          objectPath: `${ownerUid}/${obj.name}`,
          size,
        });
      }

      if (data.length < pageSize) {
        break;
      }
      offset += data.length;
    }

    return entries;
  }

  async issueSignedUploadUrls(
    ownerUid: string,
    items: UploadUrlRequestItem[],
  ): Promise<IssuedUploadUrlItem[]> {
    const validated = validateUploadRequestItems(items);
    const existingEntries = await this.listOwnerObjects(ownerUid);
    const existingPaths = new Set(existingEntries.map((entry) => entry.objectPath));

    const storageBucket = this.storage.from(this.bucket);
    const results: IssuedUploadUrlItem[] = [];

    for (const item of validated) {
      const objectPath = `${ownerUid}/${item.sha256}.${item.ext}`;
      const { data: pub } = storageBucket.getPublicUrl(objectPath);
      if (existingPaths.has(objectPath)) {
        results.push({
          sha256: item.sha256,
          objectPath,
          publicUrl: pub.publicUrl,
          exists: true,
        });
        continue;
      }

      const { data: signed, error } = await storageBucket.createSignedUploadUrl(objectPath, {
        upsert: true,
      });
      if (error || !signed) {
        throw new Error(`Failed to create signed upload URL: ${error?.message ?? 'unknown error'}`);
      }

      results.push({
        sha256: item.sha256,
        objectPath,
        publicUrl: pub.publicUrl,
        exists: false,
        signedUrl: signed.signedUrl,
        token: signed.token,
      });
    }

    return results;
  }

  async getStorageUsage(ownerUid: string): Promise<StorageUsageSummary> {
    const entries = await this.listOwnerObjects(ownerUid);
    let totalBytes = 0;
    for (const entry of entries) {
      totalBytes += entry.size;
    }
    return {
      bucket: this.bucket,
      objectCount: entries.length,
      totalBytes,
      configured: true,
    };
  }

  async cleanupOrphanedAssets(
    ownerUid: string,
    referencedPaths: ReadonlySet<string>,
  ): Promise<CleanupOrphansResult> {
    const entries = await this.listOwnerObjects(ownerUid);
    const orphans = entries.filter((entry) => !referencedPaths.has(entry.objectPath));
    if (orphans.length === 0) {
      return {
        scannedCount: entries.length,
        deletedCount: 0,
        freedBytes: 0,
      };
    }

    const storageBucket = this.storage.from(this.bucket);
    const batchSize = 100;
    let deletedCount = 0;
    let freedBytes = 0;

    for (let i = 0; i < orphans.length; i += batchSize) {
      const chunk = orphans.slice(i, i + batchSize);
      const { error } = await storageBucket.remove(chunk.map((c) => c.objectPath));
      if (error) {
        throw new Error(`Failed to remove orphaned storage objects: ${error.message}`);
      }
      deletedCount += chunk.length;
      for (const item of chunk) {
        freedBytes += item.size;
      }
    }

    return {
      scannedCount: entries.length,
      deletedCount,
      freedBytes,
    };
  }
}

export function createDefaultAssetStorageService(): AssetStorageService {
  let config: { supabaseUrl: string; serviceRoleKey: string };
  try {
    config = getSupabaseServiceRoleConfig();
  } catch (err) {
    throw new StorageConfigurationError(
      err instanceof Error ? err.message : 'Supabase Storage is not configured.',
    );
  }
  const storage = new StorageClient(`${config.supabaseUrl.replace(/\/+$/, '')}/storage/v1`, {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  });
  return new SupabaseAssetStorageService(storage, MAP_ASSETS_BUCKET);
}
