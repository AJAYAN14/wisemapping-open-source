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

import type { Folder } from '../../classes/client';

export interface FolderTreeNode {
  folder: Folder;
  children: FolderTreeNode[];
  depth: number;
}

/** Builds a sorted hierarchical folder tree from a flat folder list, guarding against cycles. */
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const byParent = new Map<number | null, Folder[]>();
  const validIds = new Set(folders.map((f) => f.id));

  for (const folder of folders) {
    const parentKey =
      folder.parentId !== null && folder.parentId !== folder.id && validIds.has(folder.parentId)
        ? folder.parentId
        : null;
    const siblings = byParent.get(parentKey) ?? [];
    siblings.push(folder);
    byParent.set(parentKey, siblings);
  }

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans') || a.id - b.id);
  }

  const visited = new Set<number>();
  const buildLevel = (parentId: number | null, depth: number): FolderTreeNode[] => {
    const list = byParent.get(parentId) ?? [];
    const nodes: FolderTreeNode[] = [];
    for (const folder of list) {
      if (visited.has(folder.id)) {
        continue;
      }
      visited.add(folder.id);
      nodes.push({
        folder,
        depth,
        children: buildLevel(folder.id, depth + 1),
      });
    }
    return nodes;
  };

  return buildLevel(null, 0);
}

/** Returns the ordered ancestor chain [root, ..., folder] for the given folderId. */
export function getFolderBreadcrumbs(folders: Folder[], folderId: number): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: Folder[] = [];
  const visited = new Set<number>();
  let cur: number | null = folderId;

  while (cur !== null && !visited.has(cur)) {
    visited.add(cur);
    const folder = byId.get(cur);
    if (!folder) {
      break;
    }
    chain.unshift(folder);
    cur = folder.parentId ?? null;
  }

  return chain;
}

/** Returns the canonical trailing-slash path string (e.g. "Work/2026/") for a folderId. */
export function getFolderPathString(folders: Folder[], folderId: number | null): string {
  if (folderId === null) {
    return '';
  }
  const chain = getFolderBreadcrumbs(folders, folderId);
  return chain.length > 0 ? `${chain.map((f) => f.name).join('/')}/` : '';
}
