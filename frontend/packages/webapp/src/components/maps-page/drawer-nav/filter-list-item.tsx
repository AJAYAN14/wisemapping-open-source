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
import React, { ReactElement, useState } from 'react';
import { useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { Filter, LabelFilter } from '../index';
import { MAP_IDS_DRAG_MIME } from '../folderTree';
import { APPLE_FONT_STACK, appleColors, isDarkTheme } from '../appleDesign';
import { DeleteLabelButton, FilterItemRoot, FilterListItemButton } from './styled';

export interface ListItemProps {
  icon: React.ReactElement;
  label: string;
  filter: Filter;
  active?: Filter;
  count?: number | undefined;
  onDropMaps?: ((mapIds: number[]) => void) | undefined;
  onClick: (filter: Filter) => void;
  onDelete?: (id: number) => void;
}

const StyleListItem = (props: ListItemProps): ReactElement => {
  const intl = useIntl();
  const icon = props.icon;
  const label = props.label;
  const filter = props.filter;
  const activeFilter = props.active;
  const count = props.count;
  const onDropMaps = props.onDropMaps;
  const onClick = props.onClick;
  const onDeleteLabel = props.onDelete;
  const [isDragTarget, setIsDragTarget] = useState(false);

  const isSelected =
    activeFilter &&
    activeFilter.type == filter.type &&
    (activeFilter.type != 'label' ||
      (activeFilter as LabelFilter).label == (filter as LabelFilter).label);
  const handleOnClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>, filter: Filter) => {
    event.stopPropagation();
    onClick(filter);
  };

  const handleOnDelete = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    filter: Filter,
  ) => {
    event.stopPropagation();
    if (!onDeleteLabel) {
      throw 'Illegal state exeption';
    }
    onDeleteLabel((filter as LabelFilter).label.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onDropMaps || !e.dataTransfer.types.includes(MAP_IDS_DRAG_MIME)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragTarget) {
      setIsDragTarget(true);
    }
  };

  const handleDragLeave = () => {
    if (isDragTarget) {
      setIsDragTarget(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragTarget(false);
    if (!onDropMaps || !e.dataTransfer.types.includes(MAP_IDS_DRAG_MIME)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = e.dataTransfer.getData(MAP_IDS_DRAG_MIME);
      const ids = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length > 0) {
        onDropMaps(ids.filter((id): id is number => typeof id === 'number'));
      }
    } catch {
      // ignore malformed drag payload
    }
  };

  return (
    <FilterItemRoot>
      <FilterListItemButton
        selected={isSelected}
        onClick={(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => handleOnClick(e, filter)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={(theme) => {
          if (!isDragTarget) return {};
          const c = appleColors(isDarkTheme(theme));
          return {
            backgroundColor: c.amberSoft,
            outline: `2px dashed ${c.amber}`,
            outlineOffset: '-2px',
          };
        }}
      >
        <Tooltip title={label} disableInteractive>
          <ListItemIcon>{icon}</ListItemIcon>
        </Tooltip>
        <ListItemText primary={label} />
        {typeof count === 'number' && count > 0 && (
          <Box
            component="span"
            sx={(theme) => {
              const c = appleColors(isDarkTheme(theme));
              return {
                fontSize: '0.72rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: APPLE_FONT_STACK,
                color: isSelected ? c.amberText : c.textTertiary,
                px: '6px',
                py: '1px',
                borderRadius: '999px',
                backgroundColor: isSelected ? 'transparent' : c.hoverFill,
              };
            }}
          >
            {count}
          </Box>
        )}
        {filter.type == 'label' && (
          <ListItemSecondaryAction>
            <DeleteLabelButton
              edge="end"
              aria-label={intl.formatMessage({ id: 'common.delete', defaultMessage: 'Delete' })}
              onClick={(e) => handleOnDelete(e, filter)}
              size="small"
              className="label-delete-button"
            >
              <CloseRoundedIcon sx={{ fontSize: '1rem', color: 'inherit' }} />
            </DeleteLabelButton>
          </ListItemSecondaryAction>
        )}
      </FilterListItemButton>
    </FilterItemRoot>
  );
};

export default StyleListItem;
