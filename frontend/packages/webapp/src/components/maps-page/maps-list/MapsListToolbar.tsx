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
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DriveFileMoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import type { Folder } from '../../../classes/client';
import type { Filter } from '..';
import { getFolderBreadcrumbs } from '../folderTree';
import { isFolderFilter, isLabelFilter } from './model';
import { APPLE_FONT_STACK } from '../appleDesign';
import {
  BulkActionButton,
  CountPill,
  ListToolbar,
  SearchBox,
  SearchContainer,
  SearchIconWrapper,
  SearchInput,
  SearchShortcutHint,
  ToolbarActions,
  ToolbarEnd,
  ToolbarRightCluster,
  WorkspaceHeading,
  WorkspaceTitle,
} from './styled';

interface MapsListToolbarProps {
  filter?: Filter;
  folders?: Folder[];
  totalCount?: number;
  selectedCount: number;
  onDeleteSelected: () => void;
  onLabelSelected: () => void;
  onMoveSelected?: (() => void) | undefined;
  onFilterChange?: ((filter: Filter) => void) | undefined;
  onSearchChange: (value: string) => void;
  /** Shown at the end of the toolbar: the pagination, on wide screens. */
  end?: React.ReactNode;
}

/** Above the list: workspace heading / bulk actions, Spotlight search, and pagination. */
export const MapsListToolbar = ({
  filter,
  folders = [],
  totalCount,
  selectedCount,
  onDeleteSelected,
  onLabelSelected,
  onMoveSelected,
  onFilterChange,
  onSearchChange,
  end,
}: MapsListToolbarProps): React.ReactElement => {
  const intl = useIntl();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

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

  const folderBreadcrumbs =
    filter && isFolderFilter(filter) ? getFolderBreadcrumbs(folders, filter.folderId) : [];

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
      return folderBreadcrumbs[folderBreadcrumbs.length - 1]?.name ?? '文件夹';
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
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
            {folderBreadcrumbs.length > 0 && onFilterChange && (
              <Box
                aria-label="文件夹路径"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '2px',
                  fontFamily: APPLE_FONT_STACK,
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                }}
              >
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  color="inherit"
                  onClick={() => onFilterChange({ type: 'all' })}
                  sx={{ fontFamily: APPLE_FONT_STACK, fontSize: '0.76rem', fontWeight: 600 }}
                >
                  {intl.formatMessage({ id: 'maps.nav-all', defaultMessage: '所有' })}
                </Link>
                {folderBreadcrumbs.map((crumb, idx) => {
                  const isLast = idx === folderBreadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <NavigateNextRoundedIcon sx={{ fontSize: 14, opacity: 0.55 }} />
                      {isLast ? (
                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                          {crumb.name}
                        </Box>
                      ) : (
                        <Link
                          component="button"
                          type="button"
                          underline="hover"
                          color="inherit"
                          onClick={() => onFilterChange({ type: 'folder', folderId: crumb.id })}
                          sx={{ fontFamily: APPLE_FONT_STACK, fontSize: '0.76rem', fontWeight: 600 }}
                        >
                          {crumb.name}
                        </Link>
                      )}
                    </React.Fragment>
                  );
                })}
              </Box>
            )}
            <WorkspaceHeading>
              <WorkspaceTitle>{headingText}</WorkspaceTitle>
              {typeof totalCount === 'number' && <CountPill>{totalCount}</CountPill>}
            </WorkspaceHeading>
          </Box>
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

        {end && <ToolbarEnd>{end}</ToolbarEnd>}
      </ToolbarRightCluster>
    </ListToolbar>
  );
};
