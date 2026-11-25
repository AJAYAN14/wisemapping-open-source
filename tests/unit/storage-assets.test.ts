import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiHandler } from '../../netlify/functions/api';
import { replaceInlineImagesInXml } from '../../netlify/functions/lib/inline-image-migration';
import {
  MAP_ASSETS_BUCKET,
  StorageConfigurationError,
  StorageValidationError,
  SupabaseAssetStorageService,
  extractReferencedAssetPaths,
  validateUploadRequestItems,
} from '../../netlify/functions/lib/storage';
import type { AssetStorageService } from '../../netlify/functions/lib/storage';
import {
  InMemoryMindmapRepo,
  TEST_JWT_SECRET,
  TEST_OWNER_UID,
  signTestJwt,
} from '../contract/test-helpers';

describe('Storage asset validation, deduplication, and XML migration', () => {
  const hashA = 'a'.repeat(64);
  const hashB = 'b'.repeat(64);

  it('validates upload requests and deduplicates identical sha256+mime items', () => {
    const items = validateUploadRequestItems([
      { sha256: hashA.toUpperCase(), mimeType: 'image/webp', size: 1200 },
      { sha256: hashA, mimeType: 'image/webp', size: 1200 },
      { sha256: hashB, mimeType: 'image/png', size: 2048 },
    ]);

    expect(items).toEqual([
      { sha256: hashA, mimeType: 'image/webp', ext: 'webp' },
      { sha256: hashB, mimeType: 'image/png', ext: 'png' },
    ]);

    expect(() => validateUploadRequestItems([])).toThrow(StorageValidationError);
    expect(() =>
      validateUploadRequestItems([{ sha256: 'bad-hash', mimeType: 'image/png' }]),
    ).toThrow(StorageValidationError);
    expect(() =>
      validateUploadRequestItems([{ sha256: hashA, mimeType: 'application/pdf' }]),
    ).toThrow(StorageValidationError);
    expect(() =>
      validateUploadRequestItems([{ sha256: hashA, mimeType: 'image/png', size: 6 * 1024 * 1024 }]),
    ).toThrow(StorageValidationError);
  });

  it('extracts referenced map-assets paths across mindmaps and history XMLs', () => {
    const refs = extractReferencedAssetPaths([
      `<map><topic image="120,90:https://proj.supabase.co/storage/v1/object/public/map-assets/${TEST_OWNER_UID}/${hashA}.webp"/></map>`,
      `<map><topic image="https://proj.supabase.co/storage/v1/object/public/map-assets/${TEST_OWNER_UID}/${hashB}.png"/></map>`,
    ]);

    expect(refs).toEqual(
      new Set([`${TEST_OWNER_UID}/${hashA}.webp`, `${TEST_OWNER_UID}/${hashB}.png`]),
    );
  });

  it('skips signing existing objects and only deletes unreferenced orphans', async () => {
    const removedBatches: string[][] = [];
    const signedPaths: string[] = [];

    const mockBucket = {
      list: vi.fn(async () => ({
        data: [
          { name: `${hashA}.webp`, id: '1', metadata: { size: 1000 } },
          { name: 'orphan.png', id: '2', metadata: { size: 2500 } },
        ],
        error: null,
      })),
      getPublicUrl: vi.fn((objectPath: string) => ({
        data: {
          publicUrl: `https://proj.supabase.co/storage/v1/object/public/${MAP_ASSETS_BUCKET}/${objectPath}`,
        },
      })),
      createSignedUploadUrl: vi.fn(async (objectPath: string) => {
        signedPaths.push(objectPath);
        return {
          data: {
            signedUrl: `https://proj.supabase.co/storage/v1/object/upload/sign/${MAP_ASSETS_BUCKET}/${objectPath}?token=tok`,
            token: 'tok',
            path: objectPath,
          },
          error: null,
        };
      }),
      remove: vi.fn(async (paths: string[]) => {
        removedBatches.push(paths);
        return { data: [], error: null };
      }),
    };

    const service = new SupabaseAssetStorageService(
      { from: () => mockBucket } as unknown as ConstructorParameters<typeof SupabaseAssetStorageService>[0],
      MAP_ASSETS_BUCKET,
    );

    const issued = await service.issueSignedUploadUrls(TEST_OWNER_UID, [
      { sha256: hashA, mimeType: 'image/webp', size: 1000 },
      { sha256: hashB, mimeType: 'image/png', size: 1500 },
    ]);

    expect(issued[0]).toMatchObject({
      sha256: hashA,
      exists: true,
    });
    expect(issued[0]?.signedUrl).toBeUndefined();
    expect(issued[1]).toMatchObject({
      sha256: hashB,
      exists: false,
      token: 'tok',
    });
    expect(signedPaths).toEqual([`${TEST_OWNER_UID}/${hashB}.png`]);

    const usage = await service.getStorageUsage(
      TEST_OWNER_UID,
      new Set([`${TEST_OWNER_UID}/${hashA}.webp`]),
    );
    expect(usage).toEqual({
      bucket: MAP_ASSETS_BUCKET,
      objectCount: 2,
      totalBytes: 3500,
      configured: true,
      orphanCount: 1,
      orphanBytes: 2500,
    });

    const cleanup = await service.cleanupOrphanedAssets(
      TEST_OWNER_UID,
      new Set([`${TEST_OWNER_UID}/${hashA}.webp`]),
    );
    expect(cleanup).toEqual({
      scannedCount: 2,
      deletedCount: 1,
      freedBytes: 2500,
    });
    expect(removedBatches).toEqual([[`${TEST_OWNER_UID}/orphan.png`]]);
  });

  it('replaces inline data:image URIs in XML while preserving card dimensions and deduplicating', async () => {
    const pngBase64 = Buffer.from('fake-png-bytes').toString('base64');
    const xml = `<map version="tango"><topic id="1" image="140,95:data:image/png;base64,${pngBase64}"/><topic id="2" image="100,70:data:image/png;base64,${pngBase64}"/></map>`;
    const uploaded: string[] = [];

    const res = await replaceInlineImagesInXml(xml, async (asset) => {
      uploaded.push(asset.sha256);
      return `https://cdn.example/map-assets/u/${asset.sha256}.${asset.ext}`;
    });

    expect(res.replacedCount).toBe(2);
    expect(res.uniqueAssets).toBe(1);
    expect(uploaded).toHaveLength(1);
    expect(res.xml).toContain(`image="140,95:https://cdn.example/map-assets/u/${uploaded[0]}.png"`);
    expect(res.xml).toContain(`image="100,70:https://cdn.example/map-assets/u/${uploaded[0]}.png"`);
    expect(res.xml).not.toContain('data:image/');
  });
});

describe('API /assets/* endpoints', () => {
  const originalEnv = { ...process.env };
  let repo: InMemoryMindmapRepo;
  let jwt: string;

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    delete process.env.ALLOWED_EMAIL;
    repo = new InMemoryMindmapRepo();
    jwt = await signTestJwt();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('requires auth, issues upload URLs, reports stats, and cleans up orphans safely', async () => {
    const cleanupMock = vi.fn(async () => ({
      scannedCount: 3,
      deletedCount: 1,
      freedBytes: 4096,
    }));

    const assetStorage: AssetStorageService = {
      issueSignedUploadUrls: async (uid, items) =>
        items.map((item) => ({
          sha256: item.sha256,
          objectPath: `${uid}/${item.sha256}.webp`,
          publicUrl: `https://cdn.test/storage/v1/object/public/map-assets/${uid}/${item.sha256}.webp`,
          exists: false,
          signedUrl: 'https://cdn.test/upload',
          token: 't1',
        })),
      getStorageUsage: async () => ({
        bucket: MAP_ASSETS_BUCKET,
        objectCount: 2,
        totalBytes: 8192,
        configured: true,
      }),
      cleanupOrphanedAssets: cleanupMock,
    };

    const handler = createApiHandler({ repo, assetStorage });

    const unauth = await handler(
      new Request('http://localhost:8888/api/restful/assets/stats'),
    );
    expect(unauth.status).toBe(401);

    const hash = 'c'.repeat(64);
    await repo.createMap(
      { uid: TEST_OWNER_UID, email: 'a.jian0629@gmail.com', name: 'AJian' },
      {
        title: 'With Asset',
        description: '',
        xml: `<map version="tango"><topic central="true" text="Root" image="120,80:https://cdn.test/storage/v1/object/public/map-assets/${TEST_OWNER_UID}/${hash}.webp"/></map>`,
      },
    );

    const uploadRes = await handler(
      new Request('http://localhost:8888/api/restful/assets/upload-urls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ sha256: hash, mimeType: 'image/webp', size: 1024 }],
        }),
      }),
    );
    expect(uploadRes.status).toBe(200);
    const uploadData = (await uploadRes.json()) as { items: Array<{ signedUrl?: string }> };
    expect(uploadData.items[0]?.signedUrl).toBe('https://cdn.test/upload');

    const statsRes = await handler(
      new Request('http://localhost:8888/api/restful/assets/stats', {
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    expect(statsRes.status).toBe(200);
    expect(await statsRes.json()).toMatchObject({
      db: { mapCount: 1, mapsWithInlineImages: 0 },
      storage: { bucket: MAP_ASSETS_BUCKET, objectCount: 2, totalBytes: 8192, configured: true },
    });

    const cleanRes = await handler(
      new Request('http://localhost:8888/api/restful/assets/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    expect(cleanRes.status).toBe(200);
    expect(await cleanRes.json()).toEqual({
      scannedCount: 3,
      deletedCount: 1,
      freedBytes: 4096,
    });
    expect(cleanupMock).toHaveBeenCalledWith(
      TEST_OWNER_UID,
      new Set([`${TEST_OWNER_UID}/${hash}.webp`]),
    );

    // Deleting the map also triggers best-effort orphan cleanup
    await handler(
      new Request('http://localhost:8888/api/restful/maps/1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    expect(cleanupMock).toHaveBeenCalledTimes(2);
    expect(cleanupMock).toHaveBeenLastCalledWith(TEST_OWNER_UID, new Set());
  });

  it('degrades gracefully on /assets/stats when Storage service key is unconfigured', async () => {
    const unconfiguredStorage: AssetStorageService = {
      issueSignedUploadUrls: async () => {
        throw new StorageConfigurationError('Missing service key');
      },
      getStorageUsage: async () => {
        throw new StorageConfigurationError('Missing service key');
      },
      cleanupOrphanedAssets: async () => {
        throw new StorageConfigurationError('Missing service key');
      },
    };
    const handler = createApiHandler({ repo, assetStorage: unconfiguredStorage });
    const statsRes = await handler(
      new Request('http://localhost:8888/api/restful/assets/stats', {
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    expect(statsRes.status).toBe(200);
    expect(await statsRes.json()).toMatchObject({
      storage: { configured: false, objectCount: 0, totalBytes: 0 },
    });
  });
});
