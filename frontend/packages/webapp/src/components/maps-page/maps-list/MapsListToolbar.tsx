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

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import type { MapInfo } from '../../../classes/client';
import type { Filter } from '..';
import { GoogleIcon } from '../../common/google-symbol';
import { isFolderFilter, isLabelFilter, type Order } from './model';
import type { MapsViewMode } from './useMapsListState';
import {
  APPLE_FONT_STACK,
  RADIUS_LG,
  RADIUS_MD,
  appleColors,
  isDarkTheme,
} from '../appleDesign';
import {
  BulkActionButton,
  CountPill,
  ListToolbar,
  SearchBox,
  SearchContainer,
  SearchIconWrapper,
  SearchInput,
  SearchShortcutHint,
  SegmentedPillThumb,
  SortTriggerButton,
  ToolbarActions,
  ToolbarEnd,
  ToolbarRightCluster,
  ViewModeButton,
  ViewModeGroup,
  ViewModeThumb,
  WorkspaceHeading,
  WorkspaceSegmentedButton,
  WorkspaceSegmentedGroup,
  WorkspaceTitle,
} from './styled';

interface MapsListToolbarProps {
  filter?: Filter;
  totalCount?: number;
  allMapsCount?: number | undefined;
  foldersCount?: number | undefined;
  selectedCount: number;
  onDeleteSelected: () => void;
  onLabelSelected: () => void;
  onMoveSelected?: (() => void) | undefined;
  onFilterChange?: ((filter: Filter) => void) | undefined;
  onSearchChange: (value: string) => void;
  viewMode?: MapsViewMode;
  onViewModeChange?: ((mode: MapsViewMode) => void) | undefined;
  showViewToggle?: boolean;
  order?: Order;
  orderBy?: keyof MapInfo;
  onSortChange?: ((property: keyof MapInfo, defaultOrder?: Order) => void) | undefined;
  toolbarActions?: React.ReactNode;
  /** Shown at the end of the toolbar when needed. */
  end?: React.ReactNode;
}

const SORT_OPTIONS: Array<{
  key: keyof MapInfo;
  label: string;
  defaultOrder: Order;
}> = [
  { key: 'title', label: '名称', defaultOrder: 'asc' },
  { key: 'sizeBytes', label: '大小', defaultOrder: 'desc' },
  { key: 'lastOpenTime', label: '最近打开', defaultOrder: 'desc' },
  { key: 'lastModificationTime', label: '最近修改', defaultOrder: 'desc' },
];

/** Above the list: segmented view switcher / heading / bulk actions, Spotlight search, view switcher and sort menu. */
export const MapsListToolbar = ({
  filter,
  totalCount,
  allMapsCount,
  foldersCount,
  selectedCount,
  onDeleteSelected,
  onLabelSelected,
  onMoveSelected,
  onFilterChange,
  onSearchChange,
  viewMode = 'list',
  onViewModeChange,
  showViewToggle = true,
  order = 'desc',
  orderBy = 'lastModificationTime',
  onSortChange,
  toolbarActions,
  end,
}: MapsListToolbarProps): React.ReactElement => {
  const intl = useIntl();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const allTabRef = useRef<HTMLButtonElement>(null);
  const folderTabRef = useRef<HTMLButtonElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [thumbStyle, setThumbStyle] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });
  const [animateThumb, setAnimateThumb] = useState(false);

  const isFolderActive = Boolean(filter && filter.type === 'folder');
  const isMacPlatform =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMacPlatform ? '⌘K' : 'Ctrl K';

  const measureThumb = useCallback(() => {
    const activeEl = isFolderActive ? folderTabRef.current : allTabRef.current;
    if (!activeEl || activeEl.offsetWidth === 0) {
      return;
    }
    const nextLeft = activeEl.offsetLeft;
    const nextWidth = activeEl.offsetWidth;
    setThumbStyle((prev) => {
      if (prev.ready && prev.left === nextLeft && prev.width === nextWidth) {
        return prev;
      }
      if (prev.ready) {
        setAnimateThumb(true);
      }
      return { left: nextLeft, width: nextWidth, ready: true };
    });
  }, [isFolderActive]);

  useLayoutEffect(() => {
    measureThumb();
  }, [measureThumb, allMapsCount, foldersCount]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => measureThumb());
    if (allTabRef.current) observer.observe(allTabRef.current);
    if (folderTabRef.current) observer.observe(folderTabRef.current);
    return () => observer.disconnect();
  }, [measureThumb]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showPrimaryTabs = Boolean(
    onFilterChange && (!filter || filter.type === 'all' || filter.type === 'folder'),
  );

  const headingText = (() => {
    if (!filter || filter.type === 'all') {
      return intl.formatMessage({ id: 'maps.nav-all', defaultMessage: 'All' });
    }
    if (filter.type === 'starred') {
      return intl.formatMessage({ id: 'maps.nav-starred', defaultMessage: 'Starred' });
    }
    if (filter.type === 'uncategorized') {
      return intl.formatMessage({ id: 'maps.nav-uncategorized', defaultMessage: '未分类' });
    }
    if (filter && isLabelFilter(filter)) {
      return filter.label.title;
    }
    if (filter && isFolderFilter(filter)) {
      return intl.formatMessage({ id: 'folder.section-title', defaultMessage: '文件夹' });
    }
    return intl.formatMessage({ id: 'maps.nav-all', defaultMessage: 'All' });
  })();

  return (
    <ListToolbar variant="dense">
      <ToolbarActions>
        {selectedCount > 0 ? (
          <>
            <Tooltip
              arrow={true}
              title={intl.formatMessage({
                id: 'map.delete-selected',
                defaultMessage: 'Delete selected',
              })}
            >
              <BulkActionButton
                size="medium"
                variant="text"
                type="button"
                disableElevation={true}
                onClick={onDeleteSelected}
                startIcon={<GoogleIcon name="delete" size={18} color="#EF4444" testId="DeleteRoundedIcon" />}
              >
                <span className="button-text">
                  <FormattedMessage id="action.delete" defaultMessage="Delete" />
                </span>
              </BulkActionButton>
            </Tooltip>

            <Tooltip
              arrow={true}
              title={intl.formatMessage({
                id: 'map.tooltip-add',
                defaultMessage: 'Add label to selected',
              })}
            >
              <BulkActionButton
                size="medium"
                variant="text"
                type="button"
                disableElevation={true}
                startIcon={<GoogleIcon name="label" size={18} />}
                onClick={onLabelSelected}
              >
                <span className="button-text">
                  <FormattedMessage id="action.label" defaultMessage="Add Label" />
                </span>
              </BulkActionButton>
            </Tooltip>

            {onMoveSelected && (
              <Tooltip
                arrow={true}
                title={intl.formatMessage({
                  id: 'folder.tooltip-move',
                  defaultMessage: '将选中导图移动到文件夹',
                })}
              >
                <BulkActionButton
                  size="medium"
                  variant="text"
                  type="button"
                  disableElevation={true}
                  startIcon={<GoogleIcon name="drive_file_move" size={18} />}
                  onClick={onMoveSelected}
                >
                  <span className="button-text">
                    <FormattedMessage id="action.move-to-folder" defaultMessage="移动到文件夹" />
                  </span>
                </BulkActionButton>
              </Tooltip>
            )}
          </>
        ) : showPrimaryTabs ? (
          <WorkspaceSegmentedGroup role="tablist" aria-label="主视图切换">
            {thumbStyle.ready && (
              <SegmentedPillThumb
                aria-hidden="true"
                animate={animateThumb}
                style={{
                  width: `${thumbStyle.width}px`,
                  transform: `translate3d(${thumbStyle.left}px, 0, 0)`,
                }}
              />
            )}
            <WorkspaceSegmentedButton
              ref={allTabRef}
              type="button"
              role="tab"
              hasThumb={thumbStyle.ready}
              aria-selected={!isFolderActive}
              active={!isFolderActive}
              onClick={() => onFilterChange?.({ type: 'all' })}
            >
              <GoogleIcon name="grid_view" size={17} filled={!isFolderActive} />
              <span>{intl.formatMessage({ id: 'maps.nav-all', defaultMessage: '全部导图' })}</span>
              {typeof allMapsCount === 'number' && <CountPill>{allMapsCount}</CountPill>}
            </WorkspaceSegmentedButton>
            <WorkspaceSegmentedButton
              ref={folderTabRef}
              type="button"
              role="tab"
              hasThumb={thumbStyle.ready}
              aria-selected={isFolderActive}
              active={isFolderActive}
              onClick={() => onFilterChange?.({ type: 'folder', folderId: null })}
            >
              <GoogleIcon name="folder" size={17} filled={isFolderActive} />
              <span>
                {intl.formatMessage({ id: 'folder.section-title', defaultMessage: '文件夹' })}
              </span>
              {typeof foldersCount === 'number' && <CountPill>{foldersCount}</CountPill>}
            </WorkspaceSegmentedButton>
          </WorkspaceSegmentedGroup>
        ) : (
          <WorkspaceHeading>
            <WorkspaceTitle>{headingText}</WorkspaceTitle>
            {typeof totalCount === 'number' && <CountPill>{totalCount}</CountPill>}
          </WorkspaceHeading>
        )}
      </ToolbarActions>

      <ToolbarRightCluster>
        <SearchContainer>
          <SearchBox>
            <SearchIconWrapper>
              <GoogleIcon name="search" size={17} />
            </SearchIconWrapper>
            <SearchInput
              inputRef={searchInputRef}
              value={searchValue}
              placeholder={intl.formatMessage({
                id: 'maps.search-action',
                defaultMessage: 'Search ...',
              })}
              slotProps={{
                input: {
                  'aria-label': intl.formatMessage({
                    id: 'maps.search-label',
                    defaultMessage: 'Search maps',
                  }),
                },
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onChange={(event) => {
                setSearchValue(event.target.value);
                onSearchChange(event.target.value);
              }}
            />
            {!searchFocused && searchValue.length === 0 && (
              <SearchShortcutHint aria-hidden="true">{shortcutLabel}</SearchShortcutHint>
            )}
          </SearchBox>
        </SearchContainer>

        {toolbarActions}

        {onViewModeChange && showViewToggle && (
          <ViewModeGroup role="group" aria-label="视图切换">
            <ViewModeThumb aria-hidden="true" activeIndex={viewMode === 'grid' ? 1 : 0} />
            <Tooltip arrow={true} title="列表视图">
              <ViewModeButton
                type="button"
                active={viewMode === 'list'}
                aria-label="列表视图"
                aria-pressed={viewMode === 'list'}
                onClick={() => onViewModeChange('list')}
              >
                <GoogleIcon name="format_list_bulleted" size={17} />
              </ViewModeButton>
            </Tooltip>
            <Tooltip arrow={true} title="栅格视图">
              <ViewModeButton
                type="button"
                active={viewMode === 'grid'}
                aria-label="栅格视图"
                aria-pressed={viewMode === 'grid'}
                onClick={() => onViewModeChange('grid')}
              >
                <GoogleIcon name="grid_view" size={17} filled={viewMode === 'grid'} />
              </ViewModeButton>
            </Tooltip>
          </ViewModeGroup>
        )}

        {onSortChange && (
          <>
            <Tooltip arrow={true} title="排序方式">
              <SortTriggerButton
                type="button"
                aria-label="排序方式"
                aria-haspopup="menu"
                aria-expanded={Boolean(sortMenuAnchor)}
                startIcon={<GoogleIcon name="swap_vert" size={17} />}
                onClick={(e) => setSortMenuAnchor(e.currentTarget)}
              >
                {SORT_OPTIONS.find((opt) => opt.key === orderBy)?.label ?? '排序'}
              </SortTriggerButton>
            </Tooltip>
            <Menu
              anchorEl={sortMenuAnchor}
              open={Boolean(sortMenuAnchor)}
              onClose={() => setSortMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  elevation: 0,
                  sx: (theme) => {
                    const c = appleColors(isDarkTheme(theme));
                    return {
                      mt: 0.75,
                      borderRadius: RADIUS_LG,
                      minWidth: 164,
                      p: 0.5,
                      color: c.textPrimary,
                      boxShadow: c.shadowFloat,
                      border: 'none',
                      fontFamily: APPLE_FONT_STACK,
                      backgroundColor: isDarkTheme(theme) ? '#1C1C1E' : '#FFFFFF',
                      '& .MuiMenuItem-root': {
                        borderRadius: RADIUS_MD,
                        minHeight: '34px',
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: c.hoverFill,
                        },
                      },
                    };
                  },
                },
              }}
            >
              <MenuItem
                disabled
                sx={{
                  opacity: '1 !important',
                  fontSize: '0.75rem !important',
                  fontWeight: '600 !important',
                  color: 'text.secondary',
                  minHeight: '26px !important',
                  py: '3px',
                }}
              >
                排序
              </MenuItem>
              {SORT_OPTIONS.map((option) => {
                const isActive = orderBy === option.key;
                return (
                  <MenuItem
                    key={option.key}
                    selected={isActive}
                    onClick={() => {
                      onSortChange(option.key, option.defaultOrder);
                      setSortMenuAnchor(null);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <ListItemText
                      primary={option.label}
                      slotProps={{
                        primary: {
                          sx: {
                            fontSize: '0.84rem',
                            fontWeight: isActive ? 600 : 400,
                            fontFamily: APPLE_FONT_STACK,
                          },
                        },
                      }}
                    />
                    {isActive && (
                      <GoogleIcon
                        name={order === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        size={16}
                      />
                    )}
                  </MenuItem>
                );
              })}
            </Menu>
          </>
        )}

        {end && <ToolbarEnd>{end}</ToolbarEnd>}
      </ToolbarRightCluster>
    </ListToolbar>
  );
};
