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

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { GoogleIcon } from '../../common/google-symbol';
import { RADIUS_LG } from '../appleDesign';
import { ErrorInfo, Folder, MapInfo } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { buildLoginRedirectUrl, isAuthErrorInfo, leaveTo } from '../../../utils/redirect';
import { clearHomeCache } from '../../../utils/homeCache';
import { Filter } from '..';
import { MAP_IDS_DRAG_MIME } from '../folderTree';
import ActionChooser, { ActionType } from '../action-chooser';
import ActionDispatcher from '../action-dispatcher';
import {
  FolderActionMenu,
  FolderBreadcrumbsBar,
  FolderCard,
  FolderGridCard,
  FolderMenuState,
  FolderRow,
} from './FolderItems';
import { CardSkeleton, GridCardSkeleton, MapsListSkeleton } from './MapsListSkeleton';
import { MapCard } from './MapCard';
import { MapGridCard } from './MapGridCard';
import { MapRow } from './MapRow';
import { MapsListToolbar } from './MapsListToolbar';
import { MapsTableHead } from './MapsTableHead';
import {
  ChangeLabelMutationFunctionParam,
  getChangeLabelMutationFunction,
  getFolderDirectItemCounts,
  isFolderFilter,
} from './model';
import {
  ListPagination,
  ListPaper,
  ListRoot,
  ListTable,
  ListTableContainer,
  MapsGrid,
  PaginationDesktop,
  PaginationMobile,
  ViewTransitionStage,
} from './styled';
import { useRemoveLabel, useStarMap } from './useMapMutations';
import { useMapsListState } from './useMapsListState';

// The label dialog imports these from here.
export type { ChangeLabelMutationFunctionParam };
export { getChangeLabelMutationFunction };

// A stable empty list: `data = []` would be a new array on every render while loading.
const NO_MAPS: MapInfo[] = [];

/** Below `sm` the list shows cards; the styles of both views switch at the same breakpoint. */
const narrowScreen = (theme: Theme): string => theme.breakpoints.down('sm');
/** Hysteresis band prevents scrollbar-width deltas (~16px) from oscillating between views. */
const NARROW_CONTAINER_ENTER_PX = 600;
const NARROW_CONTAINER_EXIT_PX = 660;

type RowMenu = {
  anchor?: HTMLElement | undefined;
  anchorPosition?: { top: number; left: number } | undefined;
  mapId: number;
};
type ActiveDialog = { actionType: ActionType; mapsId: number[] };

interface MapsListProps {
  filter: Filter;
  folders?: Folder[];
  onFilterChange?: ((filter: Filter) => void) | undefined;
  onCreateFolder?: ((parentId: number | null) => void) | undefined;
  onRenameFolder?: ((folder: Folder) => void) | undefined;
  onMoveFolder?: ((folder: Folder) => void) | undefined;
  onDeleteFolder?: ((folder: Folder) => void) | undefined;
  onDropMapsToFolder?: ((mapIds: number[], folderId: number | null) => void) | undefined;
  toolbarActions?: React.ReactNode;
}

export const MapsList = ({
  filter,
  folders = [],
  onFilterChange,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onDropMapsToFolder,
  toolbarActions,
}: MapsListProps): React.ReactElement => {
  const client = use(ClientContext);
  const intl = useIntl();
  const listPaperRef = useRef<HTMLDivElement>(null);
  // Read on the first render (`noSsr`): the page never paints the other view first.
  const isMobile = useMediaQuery(narrowScreen, { noSsr: true });
  // Also switch to cards when the main column itself is narrower than the table (e.g. tablet
  // with the sidebar expanded), rather than clipping columns with overflow: hidden.
  const [isNarrowContainer, setIsNarrowContainer] = useState(false);

  useEffect(() => {
    const element = listPaperRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) {
        setIsNarrowContainer((prev) =>
          prev ? width < NARROW_CONTAINER_EXIT_PX : width < NARROW_CONTAINER_ENTER_PX,
        );
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const useCardView = isMobile || isNarrowContainer;

  const {
    data: maps = NO_MAPS,
    // Only until the first list arrives: a background refetch keeps showing the maps.
    isPending: isLoadingMaps,
    isError: mapsLoadFailed,
    error: mapsError,
  } = useQuery<unknown, ErrorInfo, MapInfo[]>({
    queryKey: ['maps'],
    queryFn: () => client.fetchAllMaps(),
  });

  const isAuthFailed = mapsLoadFailed && isAuthErrorInfo(mapsError);
  useEffect(() => {
    if (isAuthFailed) {
      clearHomeCache();
      leaveTo(buildLoginRedirectUrl());
    }
  }, [isAuthFailed]);

  const {
    order,
    orderBy,
    viewMode,
    search,
    page,
    rowsPerPage,
    selected,
    childFolders,
    pagedFolders,
    filteredMaps,
    pagedMaps,
    requestSort,
    changeSort,
    changeViewMode,
    changePage,
    changeRowsPerPage,
    changeSearch,
    toggleSelected,
    selectAll,
    clearSelection,
  } = useMapsListState(filter, maps, folders);

  const isFolderView = isFolderFilter(filter);
  const folderCounts = useMemo(
    () => (isFolderView ? getFolderDirectItemCounts(folders, maps) : undefined),
    [isFolderView, folders, maps],
  );

  const [rowMenu, setRowMenu] = useState<RowMenu | undefined>(undefined);
  const [folderMenu, setFolderMenu] = useState<FolderMenuState | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | undefined>(undefined);

  // Every row gets these same functions: see MapItemHandlers.
  const { mutate: starMap } = useStarMap();
  const { mutate: removeLabel } = useRemoveLabel();
  const handleStar = useCallback(
    (id: number, starred: boolean) => starMap({ id, starred }),
    [starMap],
  );
  const handleRemoveLabel = useCallback(
    (mapId: number, labelId: number) => removeLabel({ mapId, labelId }),
    [removeLabel],
  );
  const handleOpenMenu = useCallback(
    (mapId: number, anchor: HTMLElement) => setRowMenu({ mapId, anchor }),
    [],
  );
  const handleContextMenu = useCallback(
    (mapId: number, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setRowMenu({ mapId, anchorPosition: { top: event.clientY, left: event.clientX } });
    },
    [],
  );
  const handleOpenFolder = useCallback(
    (folderId: number) => {
      onFilterChange?.({ type: 'folder', folderId });
    },
    [onFilterChange],
  );
  const handleNavigateBreadcrumb = useCallback(
    (folderId: number | null) => {
      onFilterChange?.({ type: 'folder', folderId });
    },
    [onFilterChange],
  );
  const handleOpenFolderMenu = useCallback((folder: Folder, anchor: HTMLElement) => {
    setFolderMenu({ folder, anchor });
  }, []);
  const handleFolderContextMenu = useCallback(
    (folder: Folder, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setFolderMenu({ folder, anchorPosition: { top: event.clientY, left: event.clientX } });
    },
    [],
  );
  const mapOpenFolderHandler = onFilterChange && !isFolderView ? handleOpenFolder : undefined;

  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const handleDragStart = useCallback(
    (mapId: number, event: React.DragEvent<HTMLElement>) => {
      const currentSelected = selectedRef.current;
      const dragIds =
        currentSelected.includes(mapId) && currentSelected.length > 0 ? currentSelected : [mapId];
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(MAP_IDS_DRAG_MIME, JSON.stringify(dragIds));
    },
    [],
  );

  const handleMenuClose = (action: ActionType): void => {
    if (action && rowMenu) {
      setActiveDialog({ actionType: action, mapsId: [rowMenu.mapId] });
    }
    setRowMenu(undefined);
  };

  const openBulkDialog = (actionType: ActionType): void => {
    setActiveDialog({ actionType, mapsId: selected });
  };

  const loadFailedMessage = isAuthFailed ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <span>请先登录后查看您的思维导图</span>
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<GoogleIcon name="login" size={17} />}
        onClick={() => leaveTo(buildLoginRedirectUrl())}
        sx={{ borderRadius: '8px', fontWeight: 600 }}
      >
        前往登录
      </Button>
    </Box>
  ) : (
    <FormattedMessage
      id="maps.load-error"
      defaultMessage="Your maps could not be loaded. Please try again later."
    />
  );
  const emptyMessage =
    isFolderView && !search ? (
      <FormattedMessage
        id="folder.empty-content"
        defaultMessage="此文件夹为空，可新建子文件夹、新建导图或从「全部导图」拖入导图"
      />
    ) : (
      <FormattedMessage
        id="maps.empty-result"
        defaultMessage="No matching mindmap found with the current filter criteria."
      />
    );

  const totalItemCount = childFolders.length + filteredMaps.length;
  // While loading, or when loading failed, the list is empty, but "no maps" would be wrong.
  const message = mapsLoadFailed
    ? loadFailedMessage
    : totalItemCount === 0
      ? emptyMessage
      : undefined;

  const pagination = (totalItemCount > rowsPerPage || totalItemCount > 10) && (
    <ListPagination
      count={totalItemCount}
      rowsPerPageOptions={totalItemCount > 10 ? [10, 20, 50] : []}
      labelRowsPerPage="每页"
      rowsPerPage={rowsPerPage}
      page={page}
      onPageChange={(_event, newPage) => changePage(newPage)}
      onRowsPerPageChange={(event) => changeRowsPerPage(parseInt(event.target.value, 10))}
      component="div"
    />
  );

  const cards = isLoadingMaps ? (
    <div data-testid="maps-loading" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <CardSkeleton
          // eslint-disable-next-line @eslint-react/no-array-index-key -- identical placeholders in a fixed-length list that never reorders
          key={index}
        />
      ))}
    </div>
  ) : message ? (
    <Card
      elevation={0}
      sx={{ borderRadius: RADIUS_LG, margin: '10px 14px', border: 'none' }}
    >
      <CardContent sx={{ textAlign: 'center', py: 4, fontWeight: 500 }}>{message}</CardContent>
    </Card>
  ) : (
    <>
      {pagedFolders.map((folder) => (
        <FolderCard
          key={`folder-${folder.id}`}
          folder={folder}
          count={folderCounts?.get(folder.id)}
          onOpenFolder={handleOpenFolder}
          onOpenMenu={handleOpenFolderMenu}
          onContextMenu={handleFolderContextMenu}
          onDropMaps={onDropMapsToFolder}
        />
      ))}
      {pagedMaps.map((map) => (
        <MapCard
          key={map.id}
          map={map}
          selected={selected.includes(map.id)}
          showFolderPath={!isFolderView}
          onToggleSelected={toggleSelected}
          onStar={handleStar}
          onOpenMenu={handleOpenMenu}
          onOpenFolder={mapOpenFolderHandler}
        />
      ))}
    </>
  );

  const timeField: 'lastModificationTime' | 'lastOpenTime' =
    orderBy === 'lastOpenTime' ? 'lastOpenTime' : 'lastModificationTime';

  const gridView = isLoadingMaps ? (
    <MapsGrid data-testid="maps-loading" aria-busy="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <GridCardSkeleton
          // eslint-disable-next-line @eslint-react/no-array-index-key -- identical placeholders
          key={index}
        />
      ))}
    </MapsGrid>
  ) : message ? (
    <Card
      elevation={0}
      sx={{ borderRadius: RADIUS_LG, border: 'none' }}
    >
      <CardContent sx={{ textAlign: 'center', py: 6, fontWeight: 500, color: 'text.secondary' }}>
        {message}
      </CardContent>
    </Card>
  ) : (
    <MapsGrid data-testid="maps-grid">
      {pagedFolders.map((folder) => (
        <FolderGridCard
          key={`folder-${folder.id}`}
          folder={folder}
          count={folderCounts?.get(folder.id)}
          onOpenFolder={handleOpenFolder}
          onOpenMenu={handleOpenFolderMenu}
          onContextMenu={handleFolderContextMenu}
          onDropMaps={onDropMapsToFolder}
        />
      ))}
      {pagedMaps.map((map) => (
        <MapGridCard
          key={map.id}
          map={map}
          selected={selected.includes(map.id)}
          hasAnySelected={selected.length > 0}
          timeField={timeField}
          showFolderPath={!isFolderView}
          onToggleSelected={toggleSelected}
          onStar={handleStar}
          onOpenMenu={handleOpenMenu}
          onOpenFolder={mapOpenFolderHandler}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
        />
      ))}
    </MapsGrid>
  );

  const table = (
    <ListTable size="small" stickyHeader>
      <MapsTableHead
        numSelected={selected.length}
        rowCount={filteredMaps.length}
        order={order}
        orderBy={orderBy}
        onSelectAll={selectAll}
        onRequestSort={requestSort}
      />
      <TableBody data-testid={isLoadingMaps ? 'maps-loading' : undefined} aria-busy={isLoadingMaps}>
        {isLoadingMaps ? (
          <MapsListSkeleton rowsPerPage={rowsPerPage} />
        ) : message ? (
          <TableRow>
            <TableCell
              colSpan={7}
              sx={{ textAlign: 'center', py: 6, fontWeight: 600, color: 'text.secondary' }}
            >
              {message}
            </TableCell>
          </TableRow>
        ) : (
          <>
            {pagedFolders.map((folder) => (
              <FolderRow
                key={`folder-${folder.id}`}
                folder={folder}
                count={folderCounts?.get(folder.id)}
                onOpenFolder={handleOpenFolder}
                onOpenMenu={handleOpenFolderMenu}
                onContextMenu={handleFolderContextMenu}
                onDropMaps={onDropMapsToFolder}
              />
            ))}
            {pagedMaps.map((map) => (
              <MapRow
                key={map.id}
                map={map}
                selected={selected.includes(map.id)}
                timeField={timeField}
                showFolderPath={!isFolderView}
                onToggleSelected={toggleSelected}
                onStar={handleStar}
                onOpenMenu={handleOpenMenu}
                onRemoveLabel={handleRemoveLabel}
                onOpenFolder={mapOpenFolderHandler}
                onContextMenu={handleContextMenu}
                onDragStart={handleDragStart}
              />
            ))}
          </>
        )}
      </TableBody>
    </ListTable>
  );

  return (
    <ListRoot>
      {rowMenu && (
        <ActionChooser
          anchor={rowMenu.anchor}
          anchorPosition={rowMenu.anchorPosition}
          onClose={handleMenuClose}
          mapId={rowMenu.mapId}
        />
      )}
      <FolderActionMenu
        menuState={folderMenu}
        onClose={() => setFolderMenu(null)}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onMoveFolder={onMoveFolder}
        onDeleteFolder={onDeleteFolder}
      />
      <ListPaper ref={listPaperRef} elevation={0}>
        <MapsListToolbar
          filter={filter}
          totalCount={filteredMaps.length}
          allMapsCount={maps.length}
          foldersCount={folders.length}
          selectedCount={selected.length}
          onDeleteSelected={() => openBulkDialog('delete')}
          onLabelSelected={() => openBulkDialog('label')}
          onMoveSelected={() => openBulkDialog('move-folder')}
          onFilterChange={onFilterChange}
          onSearchChange={changeSearch}
          viewMode={viewMode}
          onViewModeChange={changeViewMode}
          showViewToggle={!useCardView}
          order={order}
          orderBy={orderBy}
          onSortChange={changeSort}
          toolbarActions={toolbarActions}
        />

        {isFolderView && filter.folderId !== null && onFilterChange && (
          <FolderBreadcrumbsBar
            folders={folders}
            currentFolderId={filter.folderId}
            onNavigate={handleNavigateBreadcrumb}
            onDropMaps={onDropMapsToFolder}
          />
        )}

        {useCardView ? (
          <ListTableContainer>
            <div data-testid="maps-cards">{cards}</div>
          </ListTableContainer>
        ) : (
          <ViewTransitionStage
            key={`${viewMode}:${isFolderView ? `folder:${filter.folderId ?? 'root'}` : filter.type}`}
          >
            {viewMode === 'grid' ? (
              <div
                tabIndex={0}
                role="region"
                aria-label={intl.formatMessage({
                  id: 'common.maps-list',
                  defaultMessage: 'Maps list',
                })}
              >
                {gridView}
              </div>
            ) : (
              <ListTableContainer
                tabIndex={0}
                role="region"
                aria-label={intl.formatMessage({
                  id: 'common.maps-list',
                  defaultMessage: 'Maps list',
                })}
              >
                {table}
              </ListTableContainer>
            )}
          </ViewTransitionStage>
        )}

        {pagination &&
          (useCardView ? (
            <PaginationMobile>{pagination}</PaginationMobile>
          ) : (
            <PaginationDesktop sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              {pagination}
            </PaginationDesktop>
          ))}
      </ListPaper>
      <ActionDispatcher
        action={activeDialog?.actionType}
        folderId={isFolderFilter(filter) ? filter.folderId : null}
        onClose={(success) => {
          setActiveDialog(undefined);
          // A dialog that did its job leaves nothing selected.
          if (success) {
            clearSelection();
          }
        }}
        mapsId={activeDialog ? activeDialog.mapsId : []}
      />
    </ListRoot>
  );
};
