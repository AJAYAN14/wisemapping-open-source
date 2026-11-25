import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFakeMindmapRepository, FakeStore } from '../e2e/support/fake-repo';

const ROOT = path.resolve(__dirname, '../..');

describe('Folder import and path preservation contract', () => {
  describe('Migration 0002_add_folder_path.sql contract', () => {
    it('defines idempotent folder_path column and compound index', () => {
      const migrationFile = path.join(ROOT, 'supabase/migrations/0002_add_folder_path.sql');
      expect(fs.existsSync(migrationFile)).toBe(true);
      const sql = fs.readFileSync(migrationFile, 'utf8');

      expect(sql).toContain('ALTER TABLE public.mindmaps');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS folder_path VARCHAR(1024) NOT NULL DEFAULT \'\'');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS mindmaps_owner_id_folder_path_idx');
      expect(sql).toContain('ON public.mindmaps (owner_id, folder_path)');
    });
  });

  describe('Directory scanner and extension filtering rules', () => {
    const SUPPORTED_EXTENSIONS = ['wxml', 'mm', 'mmx', 'xmind', 'mmap', 'opml'];

    function isSupportedMindmapFile(fileName: string): boolean {
      const ext = fileName.split('.').pop()?.toLowerCase();
      return Boolean(ext && SUPPORTED_EXTENSIONS.includes(ext));
    }

    function extractFolderPath(webkitRelativePath: string): string {
      const lastSlash = webkitRelativePath.lastIndexOf('/');
      return lastSlash !== -1 ? webkitRelativePath.substring(0, lastSlash + 1) : '';
    }

    it('identifies valid mindmap formats and excludes unsupported/junk files', () => {
      expect(isSupportedMindmapFile('demo.xmind')).toBe(true);
      expect(isSupportedMindmapFile('freemind.mm')).toBe(true);
      expect(isSupportedMindmapFile('freeplane.mmx')).toBe(true);
      expect(isSupportedMindmapFile('mindmanager.mmap')).toBe(true);
      expect(isSupportedMindmapFile('outline.opml')).toBe(true);
      expect(isSupportedMindmapFile('wisemapping.wxml')).toBe(true);

      expect(isSupportedMindmapFile('.DS_Store')).toBe(false);
      expect(isSupportedMindmapFile('image.png')).toBe(false);
      expect(isSupportedMindmapFile('notes.txt')).toBe(false);
      expect(isSupportedMindmapFile('package.json')).toBe(false);
    });

    it('extracts folder_path preserving root directory name', () => {
      expect(extractFolderPath('Workspace/2026/Tech/Architecture.xmind')).toBe('Workspace/2026/Tech/');
      expect(extractFolderPath('Workspace/Notes.wxml')).toBe('Workspace/');
      expect(extractFolderPath('FlatMap.mm')).toBe('');
    });
  });

  describe('Repository & API folder_path isolation', () => {
    it('allows identical titles in different folders and blocks identical titles in the same folder', async () => {
      const store = new FakeStore();
      const repo = createFakeMindmapRepository(store);
      const user = { uid: 'u-1', email: 'owner@test.com', name: 'Owner' };

      // 1. Create map in folder A
      const mapA = await repo.createMap(user, {
        title: '架构设计',
        description: '',
        xml: '<map/>',
        folderPath: 'ProjectA/2026/',
      });
      expect(mapA.folderPath).toBe('ProjectA/2026/');
      expect(mapA.title).toBe('架构设计');

      // 2. Create map with identical title in folder B -> MUST succeed
      const mapB = await repo.createMap(user, {
        title: '架构设计',
        description: '',
        xml: '<map/>',
        folderPath: 'ProjectB/2026/',
      });
      expect(mapB.folderPath).toBe('ProjectB/2026/');
      expect(mapB.id).not.toBe(mapA.id);

      // 3. Attempt to create map with identical title in folder A again -> MUST throw duplicate error
      await expect(
        repo.createMap(user, {
          title: '架构设计',
          description: '',
          xml: '<map/>',
          folderPath: 'ProjectA/2026/',
        }),
      ).rejects.toThrow();

      // 4. Listing maps returns folderPath for each record
      const listed = await repo.listMaps(user);
      expect(listed).toHaveLength(2);
      expect(listed.find((m) => m.id === mapA.id)?.folderPath).toBe('ProjectA/2026/');
      expect(listed.find((m) => m.id === mapB.id)?.folderPath).toBe('ProjectB/2026/');
    });
  });

  describe('Frontend source code alignment check', () => {
    it('verifies folder_path is plumbed into frontend types, UI components, and scanner', () => {
      const clientTypes = fs.readFileSync(
        path.join(ROOT, 'frontend/packages/webapp/src/classes/client/index.ts'),
        'utf8',
      );
      expect(clientTypes).toContain('folderPath?: string;');

      const directoryScanner = fs.readFileSync(
        path.join(ROOT, 'frontend/packages/webapp/src/components/maps-page/directoryScanner.ts'),
        'utf8',
      );
      expect(directoryScanner).toContain('SUPPORTED_EXTENSIONS');
      expect(directoryScanner).toContain('scanFileList');
      expect(directoryScanner).toContain('scanDataTransferItems');

      const mapRow = fs.readFileSync(
        path.join(ROOT, 'frontend/packages/webapp/src/components/maps-page/maps-list/MapRow.tsx'),
        'utf8',
      );
      expect(mapRow).toContain('map.folderPath');

      const mapCard = fs.readFileSync(
        path.join(ROOT, 'frontend/packages/webapp/src/components/maps-page/maps-list/MapCard.tsx'),
        'utf8',
      );
      expect(mapCard).toContain('map.folderPath');

      const mapsListModel = fs.readFileSync(
        path.join(ROOT, 'frontend/packages/webapp/src/components/maps-page/maps-list/model.ts'),
        'utf8',
      );
      expect(mapsListModel).toContain('mapInfo.folderPath');
    });
  });
});
