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

import React, { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DriveFileMoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import type { MapInfo } from '../../../classes/client';
import type { Filter } from '..';
import { isFolderFilter, isLabelFilter, type Order } from './model';
import type { MapsViewMode } from './useMapsListState';
import { APPLE_FONT_STACK, appleColors, glassMaterialMixin, isDarkTheme } from '../appleDesign';
import {
  BulkActionButton,
  CountPill,
  ListToolbar,
  SearchBox,
  SearchContainer,
  SearchIconWrapper,
  SearchInput,
  SearchShortcutHint,
  SortTriggerButton,
  ToolbarActions,
  ToolbarEnd,
  ToolbarRightCluster,
  ViewModeButton,
  ViewModeGroup,
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
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);

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
                startIcon={<DeleteRoundedIcon sx={{ color: '#EF4444' }} />}
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
                startIcon={<LabelRoundedIcon />}
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
                  startIcon={<DriveFileMoveRoundedIcon />}
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
            <WorkspaceSegmentedButton
              type="button"
              role="tab"
              aria-selected={!filter || filter.type === 'all'}
              active={!filter || filter.type === 'all'}
              onClick={() => onFilterChange?.({ type: 'all' })}
            >
              <GridViewRoundedIcon />
              <span>{intl.formatMessage({ id: 'maps.nav-all', defaultMessage: '全部导图' })}</span>
              {typeof allMapsCount === 'number' && <CountPill>{allMapsCount}</CountPill>}
            </WorkspaceSegmentedButton>
            <WorkspaceSegmentedButton
              type="button"
              role="tab"
              aria-selected={Boolean(filter && filter.type === 'folder')}
              active={Boolean(filter && filter.type === 'folder')}
              onClick={() => onFilterChange?.({ type: 'folder', folderId: null })}
            >
              <FolderRoundedIcon />
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
              <SearchRoundedIcon />
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
              <SearchShortcutHint aria-hidden="true">⌘K</SearchShortcutHint>
            )}
          </SearchBox>
        </SearchContainer>

        {toolbarActions}

        {onViewModeChange && showViewToggle && (
          <ViewModeGroup role="group" aria-label="视图切换">
            <Tooltip arrow={true} title="列表视图">
              <ViewModeButton
                type="button"
                active={viewMode === 'list'}
                aria-label="列表视图"
                aria-pressed={viewMode === 'list'}
                onClick={() => onViewModeChange('list')}
              >
                <FormatListBulletedRoundedIcon />
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
                <GridViewRoundedIcon />
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
                startIcon={<SwapVertRoundedIcon sx={{ fontSize: 18 }} />}
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
                      borderRadius: '14px',
                      minWidth: 168,
                      p: 0.6,
                      color: c.textPrimary,
                      boxShadow: c.shadowFloat,
                      border: `1px solid ${c.hairline}`,
                      fontFamily: APPLE_FONT_STACK,
                      ...glassMaterialMixin(c.sidebarGlass, c.surfaceElevated, 24),
                      '& .MuiMenuItem-root': {
                        borderRadius: '8px',
                        minHeight: '36px',
                        fontSize: '0.86rem',
                        fontWeight: 600,
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
                  fontWeight: '700 !important',
                  color: 'text.secondary',
                  minHeight: '28px !important',
                  py: '4px',
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
                            fontSize: '0.86rem',
                            fontWeight: isActive ? 700 : 500,
                            fontFamily: APPLE_FONT_STACK,
                          },
                        },
                      }}
                    />
                    {isActive &&
                      (order === 'asc' ? (
                        <ArrowUpwardRoundedIcon sx={{ fontSize: 16, opacity: 0.85 }} />
                      ) : (
                        <ArrowDownwardRoundedIcon sx={{ fontSize: 16, opacity: 0.85 }} />
                      ))}
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
