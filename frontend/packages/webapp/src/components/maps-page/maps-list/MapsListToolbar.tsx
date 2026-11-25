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
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import type { Filter } from '..';
import { isLabelFilter } from './model';
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
  totalCount?: number;
  selectedCount: number;
  onDeleteSelected: () => void;
  onLabelSelected: () => void;
  onSearchChange: (value: string) => void;
  /** Shown at the end of the toolbar: the pagination, on wide screens. */
  end?: React.ReactNode;
}

/** Above the list: workspace heading / bulk actions, Spotlight search, and pagination. */
export const MapsListToolbar = ({
  filter,
  totalCount,
  selectedCount,
  onDeleteSelected,
  onLabelSelected,
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

  const headingText = (() => {
    if (!filter || filter.type === 'all') {
      return intl.formatMessage({ id: 'maps.nav-all', defaultMessage: 'All' });
    }
    if (filter.type === 'starred') {
      return intl.formatMessage({ id: 'maps.nav-starred', defaultMessage: 'Starred' });
    }
    if (filter && isLabelFilter(filter)) {
      return filter.label.title;
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
          </>
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

        {end && <ToolbarEnd>{end}</ToolbarEnd>}
      </ToolbarRightCluster>
    </ListToolbar>
  );
};
