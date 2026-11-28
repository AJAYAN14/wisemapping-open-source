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

import Client, { Folder, Label, MapInfo } from '../../../classes/client';
import type { Filter, FolderFilter, LabelFilter } from '..';
import { compareDisplayNames } from '../nameSort';

/**
 * The pure part of the map list: sorting, filtering and the label change. No React here, so it
 * is tested directly.
 */

export type Order = 'asc' | 'desc';

/** Sorts by `orderBy`: descending puts the greater value first. Uses natural numeric collation for strings. */
const descendingComparator = <T>(a: T, b: T, orderBy: keyof T): number => {
  const aVal = a[orderBy];
  const bVal = b[orderBy];
  if (typeof aVal === 'string' && typeof bVal === 'string') {
    return compareDisplayNames(bVal, aVal);
  }
  if (bVal < aVal) {
    return -1;
  }
  if (bVal > aVal) {
    return 1;
  }
  return 0;
};

export const getComparator = <T>(order: Order, orderBy: keyof T): ((a: T, b: T) => number) =>
  order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);

/** A sort that keeps the original order of equal items (Array.sort did not always). */
export const stableSort = <T>(array: T[], comparator: (a: T, b: T) => number): T[] =>
  array
    .map((item, index) => [item, index] as [T, number])
    .sort((a, b) => comparator(a[0], b[0]) || a[1] - b[1])
    .map(([item]) => item);

export const isLabelFilter = (filter: Filter): filter is LabelFilter => filter.type === 'label';

export const isFolderFilter = (filter: Filter): filter is FolderFilter => filter.type === 'folder';

/** The maps the sidebar entry selects, narrowed by the text typed in the search box. */
export const mapsFilter =
  (filter: Filter, search: string): ((mapInfo: MapInfo) => boolean) =>
  (mapInfo: MapInfo) => {
    let result: boolean;
    switch (filter.type) {
      case 'all':
        result = true;
        break;
      case 'starred':
        result = mapInfo.starred;
        break;
      case 'label':
        result =
          !mapInfo.labels ||
          mapInfo.labels.some((label) => label.id === (filter as LabelFilter).label.id);
        break;
      case 'folder':
        result = (mapInfo.folderId ?? null) === ((filter as FolderFilter).folderId ?? null);
        break;
      case 'uncategorized':
        result = (mapInfo.folderId ?? null) === null;
        break;
      default:
        result = false;
    }

    if (search && result) {
      const q = search.toLowerCase();
      result =
        mapInfo.title.toLowerCase().indexOf(q) !== -1 ||
        (mapInfo.folderPath ? mapInfo.folderPath.toLowerCase().indexOf(q) !== -1 : false);
    }
    return result;
  };

export interface FolderDirectCount {
  subfolderCount: number;
  mapCount: number;
  totalCount: number;
}

/**
 * Returns direct subfolders of `parentId` matching `search`, sorted by name (respecting
 * descending order when sorting by title; ascending otherwise). Orphan folders whose parent
 * no longer exists are treated as top-level (`null`) to match `buildFolderTree`.
 */
export const getChildFolders = (
  folders: Folder[],
  parentId: number | null,
  search: string,
  order: Order = 'asc',
  orderBy: keyof MapInfo = 'lastModificationTime',
): Folder[] => {
  const validIds = new Set(folders.map((f) => f.id));
  const query = search.trim().toLowerCase();

  const matching = folders.filter((folder) => {
    const effectiveParentId =
      folder.parentId !== null && folder.parentId !== folder.id && validIds.has(folder.parentId)
        ? folder.parentId
        : null;
    if (effectiveParentId !== parentId) {
      return false;
    }
    if (query && !folder.name.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  const direction = orderBy === 'title' && order === 'desc' ? -1 : 1;
  return [...matching].sort(
    (a, b) => direction * compareDisplayNames(a.name, b.name) || a.id - b.id,
  );
};

/** Computes direct subfolder and map counts for every folder in one linear pass. */
export const getFolderDirectItemCounts = (
  folders: Folder[],
  maps: MapInfo[],
): Map<number, FolderDirectCount> => {
  const result = new Map<number, FolderDirectCount>();
  const ensure = (id: number): FolderDirectCount => {
    let entry = result.get(id);
    if (!entry) {
      entry = { subfolderCount: 0, mapCount: 0, totalCount: 0 };
      result.set(id, entry);
    }
    return entry;
  };

  for (const folder of folders) {
    ensure(folder.id);
    if (folder.parentId !== null && folder.parentId !== folder.id) {
      const parentEntry = ensure(folder.parentId);
      parentEntry.subfolderCount += 1;
      parentEntry.totalCount += 1;
    }
  }

  for (const mapInfo of maps) {
    const fid = mapInfo.folderId ?? null;
    if (fid !== null) {
      const entry = ensure(fid);
      entry.mapCount += 1;
      entry.totalCount += 1;
    }
  }

  return result;
};

export type ChangeLabelMutationFunctionParam = { maps: MapInfo[]; label: Label; checked: boolean };

/** Adds the label to the maps that lack it, or removes it from those that have it. */
export const getChangeLabelMutationFunction =
  (client: Client) =>
  async ({ maps, label, checked }: ChangeLabelMutationFunctionParam): Promise<void> => {
    if (!label.id) {
      label.id = await client.createLabel(label.title, label.color);
    }
    if (checked) {
      const toAdd = maps.filter((m) => !m.labels.find((l) => l.id === label.id));
      await Promise.all(toAdd.map((m) => client.addLabelToMap(label.id, m.id)));
    } else {
      const toRemove = maps.filter((m) => m.labels.find((l) => l.id === label.id));
      await Promise.all(toRemove.map((m) => client.deleteLabelFromMap(label.id, m.id)));
    }
  };
