import path from 'node:path';
import dotenv from 'dotenv';
import { StorageClient } from '@supabase/storage-js';
import { getDbPool, closeDbPool } from '../api/_core/lib/db';
import { getSupabaseServiceRoleConfig } from '../api/_core/lib/env';
import { replaceInlineImagesInXml } from '../api/_core/lib/inline-image-migration';
import { MAP_ASSETS_BUCKET } from '../api/_core/lib/storage';

const rootDir = process.cwd();
dotenv.config({ path: path.resolve(rootDir, '.env.local'), override: true });
dotenv.config({ path: path.resolve(rootDir, '.env'), override: false });

async function main(): Promise<void> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceRoleConfig();
  const storage = new StorageClient(`${supabaseUrl.replace(/\/+$/, '')}/storage/v1`, {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  });
  const pool = getDbPool();
  const storageBucket = storage.from(MAP_ASSETS_BUCKET);

  const uploadedCache = new Map<string, string>();
  const uploadForOwner = async (
    ownerId: string,
    asset: { sha256: string; ext: string; mimeType: string; bytes: Uint8Array },
  ): Promise<string> => {
    const objectPath = `${ownerId}/${asset.sha256}.${asset.ext}`;
    const cached = uploadedCache.get(objectPath);
    if (cached) {
      return cached;
    }

    const { data: existsData } = await storageBucket.exists(objectPath);
    if (!existsData) {
      const { error } = await storageBucket.upload(objectPath, asset.bytes, {
        contentType: asset.mimeType,
        cacheControl: '31536000',
        upsert: true,
      });
      if (error) {
        throw new Error(`Failed to upload ${objectPath}: ${error.message}`);
      }
    }

    const { data: pub } = storageBucket.getPublicUrl(objectPath);
    uploadedCache.set(objectPath, pub.publicUrl);
    return pub.publicUrl;
  };

  try {
    const mapsRes = await pool.query<{ id: number; owner_id: string; title: string; xml: string }>(
      `SELECT id, owner_id, title, xml FROM public.mindmaps WHERE xml LIKE '%data:image%' ORDER BY id ASC`,
    );

    console.log(`Found ${mapsRes.rows.length} mindmap(s) with inline data:image URIs.`);
    for (const row of mapsRes.rows) {
      const beforeBytes = Buffer.byteLength(row.xml, 'utf8');
      const result = await replaceInlineImagesInXml(row.xml, (asset) =>
        uploadForOwner(row.owner_id, asset),
      );
      if (result.replacedCount > 0 && result.xml !== row.xml) {
        await pool.query(`UPDATE public.mindmaps SET xml = $1 WHERE id = $2 AND owner_id = $3`, [
          result.xml,
          row.id,
          row.owner_id,
        ]);
        const afterBytes = Buffer.byteLength(result.xml, 'utf8');
        console.log(
          `[mindmaps #${row.id} "${row.title}"] replaced ${result.replacedCount} inline image(s) (${result.uniqueAssets} unique): ${beforeBytes} B -> ${afterBytes} B`,
        );
      }
    }

    const histRes = await pool.query<{ id: number; owner_id: string; mindmap_id: number; xml: string }>(
      `SELECT id, owner_id, mindmap_id, xml FROM public.mindmap_history WHERE xml LIKE '%data:image%' ORDER BY id ASC`,
    );

    console.log(`Found ${histRes.rows.length} mindmap_history row(s) with inline data:image URIs.`);
    for (const row of histRes.rows) {
      const beforeBytes = Buffer.byteLength(row.xml, 'utf8');
      const result = await replaceInlineImagesInXml(row.xml, (asset) =>
        uploadForOwner(row.owner_id, asset),
      );
      if (result.replacedCount > 0 && result.xml !== row.xml) {
        await pool.query(
          `UPDATE public.mindmap_history SET xml = $1 WHERE id = $2 AND owner_id = $3`,
          [result.xml, row.id, row.owner_id],
        );
        const afterBytes = Buffer.byteLength(result.xml, 'utf8');
        console.log(
          `[mindmap_history #${row.id} (map #${row.mindmap_id})] replaced ${result.replacedCount} inline image(s): ${beforeBytes} B -> ${afterBytes} B`,
        );
      }
    }
  } finally {
    await closeDbPool();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
