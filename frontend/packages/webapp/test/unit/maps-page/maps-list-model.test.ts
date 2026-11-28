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

import { Folder, Label, MapInfo } from '../../../src/classes/client';
import { buildFolderTree } from '../../../src/components/maps-page/folderTree';
import {
  getChildFolders,
  getComparator,
  getFolderDirectItemCounts,
  isLabelFilter,
  mapsFilter,
  stableSort,
} from '../../../src/components/maps-page/maps-list/model';
import {
  compareDisplayNames,
  normalizeChineseNumeralsForSort,
  parseChineseNumeral,
} from '../../../src/components/maps-page/nameSort';

const label = (id: number): Label => ({ id, title: `label ${id}`, color: '#fff' });

const map = (overrides: Partial<MapInfo> = {}): MapInfo => ({
  id: 1,
  title: 'Plan',
  starred: false,
  labels: [],
  createdBy: 'ana@wisemapping.com',
  creationTime: '2026-01-01T00:00:00Z',
  lastModificationBy: 'ana@wisemapping.com',
  lastModificationTime: '2026-01-01T00:00:00Z',
  description: '',
  public: false,
  role: 'owner',
  ...overrides,
});

describe('getComparator and stableSort', () => {
  const titles = (maps: MapInfo[]) => maps.map((m) => m.title);
  const maps = [map({ id: 1, title: 'b' }), map({ id: 2, title: 'c' }), map({ id: 3, title: 'a' })];

  test('ascending puts the smaller first, descending the greater', () => {
    expect(titles(stableSort(maps, getComparator('asc', 'title')))).toEqual(['a', 'b', 'c']);
    expect(titles(stableSort(maps, getComparator('desc', 'title')))).toEqual(['c', 'b', 'a']);
  });

  test('equal items keep their original order, in both directions', () => {
    const same = [
      map({ id: 1, title: 'x' }),
      map({ id: 2, title: 'x' }),
      map({ id: 3, title: 'x' }),
    ];
    const ids = (list: MapInfo[]) => list.map((m) => m.id);

    expect(ids(stableSort(same, getComparator('asc', 'title')))).toEqual([1, 2, 3]);
    expect(ids(stableSort(same, getComparator('desc', 'title')))).toEqual([1, 2, 3]);
  });

  test('sorts booleans and does not change the list it is given', () => {
    const starred = [map({ id: 1 }), map({ id: 2, starred: true })];
    const copy = [...starred];

    expect(stableSort(starred, getComparator('desc', 'starred')).map((m) => m.id)).toEqual([2, 1]);
    expect(starred).toEqual(copy);
  });

  test('a missing value compares as equal, so the order holds', () => {
    type Described = { id: number; description?: string };
    const list: Described[] = [{ id: 1 }, { id: 2, description: 'x' }];
    expect(
      stableSort(list, getComparator<Described>('asc', 'description')).map((m) => m.id),
    ).toEqual([1, 2]);
  });
});

describe('mapsFilter', () => {
  const uncategorized = map({ id: 1, title: 'Owned plan', role: 'owner' });
  const inFolder = map({
    id: 2,
    title: 'Shared plan',
    role: 'editor',
    folderId: 10,
    folderPath: 'Work/Projects/',
  });
  const starred = map({ id: 3, title: 'Starred', starred: true, folderId: 10 });
  const tagged = map({ id: 4, title: 'Tagged', labels: [label(7)] });
  const maps = [uncategorized, inFolder, starred, tagged];
  const ids = (filter: Parameters<typeof mapsFilter>[0], search = '') =>
    maps.filter(mapsFilter(filter, search)).map((m) => m.id);

  test.each([
    ['all', { type: 'all' as const }, [1, 2, 3, 4]],
    ['uncategorized', { type: 'uncategorized' as const }, [1, 4]],
    ['folder root', { type: 'folder' as const, folderId: null }, [1, 4]],
    ['starred', { type: 'starred' as const }, [3]],
    ['folder', { type: 'folder' as const, folderId: 10 }, [2, 3]],
  ])('the %s entry', (_name, filter, expected) => {
    expect(ids(filter)).toEqual(expected);
  });

  test('the label entry lists the maps with that label', () => {
    expect(ids({ type: 'label', label: label(7) })).toEqual([4]);
    expect(ids({ type: 'label', label: label(9) })).toEqual([]);
  });

  test('an unknown entry lists nothing', () => {
    expect(ids({ type: 'bogus' } as never)).toEqual([]);
  });

  test('the search narrows the entry by title or folder path, ignoring case', () => {
    expect(ids({ type: 'all' }, 'PLAN')).toEqual([1, 2]);
    expect(ids({ type: 'folder', folderId: 10 }, 'work')).toEqual([2]);
    expect(ids({ type: 'all' }, 'nothing like this')).toEqual([]);
  });

  test('the search does not include a map its entry left out', () => {
    expect(ids({ type: 'starred' }, 'plan')).toEqual([]);
  });

  test('isLabelFilter tells the label entry from the others', () => {
    expect(isLabelFilter({ type: 'label', label: label(1) })).toBe(true);
    expect(isLabelFilter({ type: 'all' })).toBe(false);
  });
});

describe('getChildFolders and getFolderDirectItemCounts', () => {
  const folder = (id: number, name: string, parentId: number | null = null): Folder => ({
    id,
    name,
    parentId,
  });

  const folders: Folder[] = [
    folder(1, '2.10 章', null),
    folder(2, '2.2 章', null),
    folder(3, '2.2.1 小节', 2),
    folder(4, '10.1 孤儿目录', 999),
  ];

  test('lists direct children sorted naturally and treats orphans as top-level', () => {
    expect(getChildFolders(folders, null, '').map((f) => f.name)).toEqual([
      '2.2 章',
      '2.10 章',
      '10.1 孤儿目录',
    ]);
    expect(getChildFolders(folders, 2, '').map((f) => f.name)).toEqual(['2.2.1 小节']);
  });

  test('filters child folders by search text and supports descending title sort', () => {
    expect(getChildFolders(folders, null, '2.10').map((f) => f.name)).toEqual(['2.10 章']);
    expect(getChildFolders(folders, null, '', 'desc', 'title').map((f) => f.name)).toEqual([
      '10.1 孤儿目录',
      '2.10 章',
      '2.2 章',
    ]);
  });

  test('computes direct subfolder and map counts per folder', () => {
    const maps: MapInfo[] = [
      map({ id: 10, folderId: 2 }),
      map({ id: 11, folderId: 2 }),
      map({ id: 12, folderId: 3 }),
      map({ id: 13, folderId: null }),
    ];

    const counts = getFolderDirectItemCounts(folders, maps);
    expect(counts.get(2)).toEqual({ subfolderCount: 1, mapCount: 2, totalCount: 3 });
    expect(counts.get(1)).toEqual({ subfolderCount: 0, mapCount: 0, totalCount: 0 });
    expect(counts.get(3)).toEqual({ subfolderCount: 0, mapCount: 1, totalCount: 1 });
  });
});

describe('Chinese numeral natural name sorting', () => {
  const folder = (id: number, name: string, parentId: number | null = null): Folder => ({
    id,
    name,
    parentId,
  });

  test('parses valid Chinese numerals and rejects malformed combinations', () => {
    expect(parseChineseNumeral('零')).toBe(0);
    expect(parseChineseNumeral('〇')).toBe(0);
    expect(parseChineseNumeral('一')).toBe(1);
    expect(parseChineseNumeral('十')).toBe(10);
    expect(parseChineseNumeral('十一')).toBe(11);
    expect(parseChineseNumeral('二十三')).toBe(23);
    expect(parseChineseNumeral('一百零五')).toBe(105);
    expect(parseChineseNumeral('二〇二六')).toBe(2026);
    expect(parseChineseNumeral('万一')).toBeNull();
    expect(parseChineseNumeral('百')).toBeNull();
    expect(parseChineseNumeral('十十')).toBeNull();
    expect(parseChineseNumeral('一二')).toBeNull();
  });

  test('sorts Chinese chapter folders naturally in both directions and in the sidebar tree', () => {
    const chapters: Folder[] = [
      folder(1, '附录'),
      folder(2, '第五章、常用传动元件的选型'),
      folder(3, '第三章、常用电机的选型与应用'),
      folder(4, '第七章、输送机构设计选型'),
      folder(5, '第六章、FA零部件选型'),
      folder(6, '第二章、非标机械设计基础'),
      folder(7, '第八章、常用附件选型'),
      folder(8, '第十章、综合案例'),
      folder(9, '第十二章、扩展专题'),
    ];

    expect(getChildFolders(chapters, null, '', 'asc', 'title').map((f) => f.name)).toEqual([
      '第二章、非标机械设计基础',
      '第三章、常用电机的选型与应用',
      '第五章、常用传动元件的选型',
      '第六章、FA零部件选型',
      '第七章、输送机构设计选型',
      '第八章、常用附件选型',
      '第十章、综合案例',
      '第十二章、扩展专题',
      '附录',
    ]);

    expect(getChildFolders(chapters, null, '', 'desc', 'title').map((f) => f.name)).toEqual([
      '附录',
      '第十二章、扩展专题',
      '第十章、综合案例',
      '第八章、常用附件选型',
      '第七章、输送机构设计选型',
      '第六章、FA零部件选型',
      '第五章、常用传动元件的选型',
      '第三章、常用电机的选型与应用',
      '第二章、非标机械设计基础',
    ]);

    expect(buildFolderTree(chapters).map((node) => node.folder.name)).toEqual([
      '第二章、非标机械设计基础',
      '第三章、常用电机的选型与应用',
      '第五章、常用传动元件的选型',
      '第六章、FA零部件选型',
      '第七章、输送机构设计选型',
      '第八章、常用附件选型',
      '第十章、综合案例',
      '第十二章、扩展专题',
      '附录',
    ]);
  });

  test('sorts delimited, parenthesized, and suffixed Chinese numerals naturally for map titles', () => {
    const maps = [
      map({ id: 1, title: '十、总结' }),
      map({ id: 2, title: '二、方案' }),
      map({ id: 3, title: '一、背景' }),
      map({ id: 4, title: '（十）附注' }),
      map({ id: 5, title: '（二）细节' }),
      map({ id: 6, title: '（一）总览' }),
      map({ id: 7, title: '附录十' }),
      map({ id: 8, title: '附录二' }),
      map({ id: 9, title: '附录一' }),
    ];

    expect(stableSort(maps, getComparator('asc', 'title')).map((m) => m.title)).toEqual([
      '（一）总览',
      '（二）细节',
      '（十）附注',
      '一、背景',
      '二、方案',
      '十、总结',
      '附录一',
      '附录二',
      '附录十',
    ]);
  });

  test('leaves ordinary Chinese words untouched so pinyin grouping stays intact', () => {
    expect(normalizeChineseNumeralsForSort('统一')).toBe('统一');
    expect(normalizeChineseNumeralsForSort('万一')).toBe('万一');
    expect(normalizeChineseNumeralsForSort('三角形')).toBe('三角形');
    expect(compareDisplayNames('统一', '统战')).toBeLessThan(0);
    expect(compareDisplayNames('统一', '统一标准')).toBeLessThan(0);
  });
});
