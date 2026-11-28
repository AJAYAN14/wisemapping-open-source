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

import { useCallback, useMemo, useState } from 'react';
import { Folder, MapInfo } from '../../../classes/client';
import { readStorage, writeStorage } from '../../../utils/storage';
import type { Filter } from '..';
import {
  Order,
  getChildFolders,
  getComparator,
  isFolderFilter,
  isLabelFilter,
  mapsFilter,
  stableSort,
} from './model';

export type MapsViewMode = 'list' | 'grid';

const NO_FOLDERS: Folder[] = [];
const VIEW_MODE_STORAGE_KEY = 'mapsListViewMode';
const ORDER_BY_STORAGE_KEY = 'mapsListOrderBy';
const ORDER_STORAGE_KEY = 'mapsListOrder';
const ALLOWED_SORT_KEYS: ReadonlySet<keyof MapInfo> = new Set([
  'title',
  'sizeBytes',
  'lastOpenTime',
  'lastModificationTime',
  'labels',
]);

const readStoredViewMode = (): MapsViewMode => {
  const stored = readStorage(VIEW_MODE_STORAGE_KEY);
  return stored === 'grid' ? 'grid' : 'list';
};

const readStoredOrderBy = (): keyof MapInfo => {
  const stored = readStorage(ORDER_BY_STORAGE_KEY) as keyof MapInfo | null;
  return stored && ALLOWED_SORT_KEYS.has(stored) ? stored : 'lastModificationTime';
};

const readStoredOrder = (): Order => {
  const stored = readStorage(ORDER_STORAGE_KEY);
  return stored === 'asc' ? 'asc' : 'desc';
};

/** What identifies the sidebar or folder entry: choosing the same entry again hands over a new object. */
const entryKey = (filter: Filter): string =>
  isLabelFilter(filter)
    ? `label:${filter.label.id}`
    : isFolderFilter(filter)
      ? `folder:${filter.folderId ?? 'root'}`
      : filter.type;

export interface MapsListState {
  order: Order;
  orderBy: keyof MapInfo;
  viewMode: MapsViewMode;
  search: string;
  /** The page shown, 0-based: always one that exists. */
  page: number;
  rowsPerPage: number;
  selected: number[];
  selectedFolders: number[];
  /** Direct subfolders of the active folder matching search, in display sort order. */
  childFolders: Folder[];
  /** The subfolders shown on the current page. */
  pagedFolders: Folder[];
  /** The maps the entry and the search list, on every page. */
  filteredMaps: MapInfo[];
  /** The filtered maps in display sort order. */
  sortedMaps: MapInfo[];
  /** The maps of the page shown, sorted. */
  pagedMaps: MapInfo[];
  requestSort: (property: keyof MapInfo) => void;
  changeSort: (property: keyof MapInfo, defaultOrder?: Order) => void;
  changeViewMode: (mode: MapsViewMode) => void;
  changePage: (newPage: number) => void;
  changeRowsPerPage: (count: number) => void;
  changeSearch: (value: string) => void;
  toggleSelected: (id: number) => void;
  toggleFolderSelected: (id: number) => void;
  selectAll: (checked: boolean) => void;
  clearSelection: () => void;
  isSelected: (id: number) => boolean;
  isFolderSelected: (id: number) => boolean;
}

const getMapComparator = (
  order: Order,
  orderBy: keyof MapInfo,
): ((a: MapInfo, b: MapInfo) => number) => {
  if (orderBy === 'sizeBytes') {
    return (a, b) => {
      const diff = (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
      return order === 'desc' ? diff : -diff;
    };
  }
  if (orderBy === 'lastOpenTime') {
    return (a, b) => {
      const aTime = a.lastOpenTime ?? a.lastModificationTime;
      const bTime = b.lastOpenTime ?? b.lastModificationTime;
      const cmp = bTime.localeCompare(aTime);
      return order === 'desc' ? cmp : -cmp;
    };
  }
  return getComparator<MapInfo>(order, orderBy);
};

export const useMapsListState = (
  filter: Filter,
  maps: MapInfo[],
  folders: Folder[] = NO_FOLDERS,
): MapsListState => {
  const [order, setOrder] = useState<Order>(readStoredOrder);
  const [orderBy, setOrderBy] = useState<keyof MapInfo>(readStoredOrderBy);
  const [viewMode, setViewMode] = useState<MapsViewMode>(readStoredViewMode);
  const [search, setSearch] = useState('');
  const [requestedPage, setRequestedPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<number[]>([]);

  // Adjusted while rendering, not in an effect: the list never shows a frame of the old entry's
  // selection or page.
  const key = entryKey(filter);
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setSelected([]);
    setSelectedFolders([]);
    setRequestedPage(0);
  }

  const childFolders = useMemo(
    () =>
      isFolderFilter(filter)
        ? getChildFolders(folders, filter.folderId ?? null, search, order, orderBy)
        : NO_FOLDERS,
    [filter, folders, search, order, orderBy],
  );

  const visibleFolderIds = useMemo(
    () => new Set(childFolders.map((folder) => folder.id)),
    [childFolders],
  );
  const activeSelectedFolders = useMemo(
    () => selectedFolders.filter((id) => visibleFolderIds.has(id)),
    [selectedFolders, visibleFolderIds],
  );

  const filteredMaps = useMemo(
    () => maps.filter(mapsFilter(filter, search)),
    [maps, filter, search],
  );
  const sortedMaps = useMemo(
    () => stableSort(filteredMaps, getMapComparator(order, orderBy)),
    [filteredMaps, order, orderBy],
  );

  const totalItems = childFolders.length + sortedMaps.length;
  const lastPage = Math.max(0, Math.ceil(totalItems / rowsPerPage) - 1);
  const page = Math.min(requestedPage, lastPage);

  const pagedFolders = useMemo(
    () => childFolders.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [childFolders, page, rowsPerPage],
  );

  const pagedMaps = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    const mapStart = Math.max(0, start - childFolders.length);
    const mapEnd = Math.max(0, end - childFolders.length);
    return sortedMaps.slice(mapStart, mapEnd);
  }, [sortedMaps, page, rowsPerPage, childFolders.length]);

  /** A selection kept across a search would include maps the search hides. */
  const changeSearch = useCallback((value: string): void => {
    setSearch(value);
    setSelected([]);
    setSelectedFolders([]);
    setRequestedPage(0);
  }, []);
  const changePage = useCallback((newPage: number): void => setRequestedPage(newPage), []);
  const changeRowsPerPage = useCallback((count: number): void => {
    setRowsPerPage(count);
    setRequestedPage(0);
  }, []);
  const changeViewMode = useCallback((mode: MapsViewMode): void => {
    setViewMode(mode);
    writeStorage(VIEW_MODE_STORAGE_KEY, mode);
  }, []);
  const toggleSelected = useCallback(
    (id: number): void =>
      setSelected((current) =>
        current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
      ),
    [],
  );
  const toggleFolderSelected = useCallback(
    (id: number): void =>
      setSelectedFolders((current) =>
        current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
      ),
    [],
  );
  const clearSelection = useCallback((): void => {
    setSelected([]);
    setSelectedFolders([]);
  }, []);

  const persistSort = (nextOrderBy: keyof MapInfo, nextOrder: Order): void => {
    setOrderBy(nextOrderBy);
    setOrder(nextOrder);
    writeStorage(ORDER_BY_STORAGE_KEY, String(nextOrderBy));
    writeStorage(ORDER_STORAGE_KEY, nextOrder);
  };

  return {
    order,
    orderBy,
    viewMode,
    search,
    page,
    rowsPerPage,
    selected,
    selectedFolders: activeSelectedFolders,
    childFolders,
    pagedFolders,
    filteredMaps,
    sortedMaps,
    pagedMaps,

    /** Sorts by the column, or reverses the order if it already is the sort column. */
    requestSort: (property: keyof MapInfo): void => {
      const nextOrder: Order = orderBy === property && order === 'asc' ? 'desc' : 'asc';
      persistSort(property, nextOrder);
    },
    changeSort: (property: keyof MapInfo, defaultOrder: Order = 'desc'): void => {
      const nextOrder: Order =
        orderBy === property ? (order === 'asc' ? 'desc' : 'asc') : defaultOrder;
      persistSort(property, nextOrder);
    },
    changeViewMode,
    changePage,
    changeRowsPerPage,
    changeSearch,
    toggleSelected,
    toggleFolderSelected,
    /** Every map and folder the entry and the search list include, on every page. */
    selectAll: (checked: boolean): void => {
      setSelected(checked ? filteredMaps.map((map) => map.id) : []);
      setSelectedFolders(checked ? childFolders.map((folder) => folder.id) : []);
    },
    clearSelection,
    isSelected: (id: number): boolean => selected.includes(id),
    isFolderSelected: (id: number): boolean => activeSelectedFolders.includes(id),
  };
};
