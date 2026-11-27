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

import React, { memo, use } from 'react';
import { useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import { Label, MapInfo } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { useDate } from '../../../classes/app-i18n/dates';
import { buildMapEditPath } from '../../../utils/mapPath';
import { handleSpaLinkClick } from '../../../utils/appNavigation';
import { prefetchMapForOpen, preloadEditorResources } from '../../../utils/editorPreload';
import { formatMapSize } from '../../../utils/mapPreview';
import { GoogleIcon } from '../../common/google-symbol';
import { LabelsCell } from './labels-cell';
import { MapFolderPathBadge } from './MapFolderPathBadge';
import {
  ActionIconButton,
  BodyCell,
  CellText,
  LabelsBodyCell,
  MapGlyphBadge,
  MapRowTitleWrap,
  SelectCheckbox,
  StarIcon,
  TitleLink,
} from './styled';

/**
 * What a row or a card hands back to the list. The handlers take the map's id rather than
 * closing over it, so the list passes the same functions to every row and a memoized row only
 * re-renders when its own map or selection changes.
 */
export interface MapItemHandlers {
  /** `starred` is the new value. */
  onStar: (mapId: number, starred: boolean) => void;
  /** Opens the row menu of the map next to `anchor`. */
  onOpenMenu: (mapId: number, anchor: HTMLElement) => void;
}

interface MapRowProps extends MapItemHandlers {
  map: MapInfo;
  selected: boolean;
  timeField?: 'lastModificationTime' | 'lastOpenTime';
  showFolderPath?: boolean;
  onToggleSelected: (mapId: number) => void;
  onRemoveLabel: (mapId: number, labelId: number) => void;
  onOpenFolder?: ((folderId: number) => void) | undefined;
  onContextMenu?: (mapId: number, event: React.MouseEvent<HTMLTableRowElement>) => void;
  onDragStart?: (mapId: number, event: React.DragEvent<HTMLTableRowElement>) => void;
}

/** A map in the table: clicking the row (anywhere but its controls) selects it. */
const MapRowComponent = ({
  map,
  selected,
  timeField = 'lastModificationTime',
  showFolderPath = true,
  onToggleSelected,
  onStar,
  onOpenMenu,
  onRemoveLabel,
  onOpenFolder,
  onContextMenu,
  onDragStart,
}: MapRowProps): React.ReactElement => {
  const intl = useIntl();
  const date = useDate();
  const client = use(ClientContext);
  const editPath = buildMapEditPath(map.folderPath, map.title);
  const displayTime =
    timeField === 'lastOpenTime'
      ? (map.lastOpenTime ?? map.lastModificationTime)
      : map.lastModificationTime;

  const handleStar = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    onStar(map.id, !map.starred);
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
    onOpenMenu(map.id, event.currentTarget);
    event.preventDefault();
    // The row toggles its selection on click: opening the menu must not.
    event.stopPropagation();
  };

  return (
    <TableRow
      hover
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart ? (e) => onDragStart(map.id, e) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(map.id, e) : undefined}
      onClick={() => onToggleSelected(map.id)}
      tabIndex={-1}
      selected={selected}
      sx={{ cursor: onDragStart ? 'grab' : undefined }}
    >
      <BodyCell padding="checkbox">
        <SelectCheckbox
          checked={selected}
          size="small"
          icon={<CheckBoxOutlineBlankRoundedIcon fontSize="small" />}
          checkedIcon={<CheckBoxRoundedIcon fontSize="small" />}
          slotProps={{
            input: {
              // Named after the map explicitly: the "Open for edition" tooltip names the title
              // link, so pointing at it read the tooltip instead of the title.
              'aria-label': intl.formatMessage(
                { id: 'maps.select-map', defaultMessage: 'Select {title}' },
                { title: map.title },
              ),
            },
          }}
        />
      </BodyCell>
      <BodyCell>
        <MapRowTitleWrap>
          <MapGlyphBadge aria-hidden="true">
            <GoogleIcon name="hub" size={18} />
          </MapGlyphBadge>
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center' }}>
            <Tooltip
              arrow={true}
              title={intl.formatMessage({
                id: 'maps.tooltip-open',
                defaultMessage: 'Open for edition',
              })}
              placement="bottom-start"
            >
              <TitleLink
                id={`map-title-${map.id}`}
                href={editPath}
                underline="none"
                onMouseEnter={() => {
                  void preloadEditorResources();
                }}
                onFocus={() => {
                  void preloadEditorResources();
                }}
                onPointerDown={() => {
                  prefetchMapForOpen(client, map.folderPath ?? '', map.title);
                }}
                onClick={(e) => handleSpaLinkClick(e, editPath)}
              >
                {map.title}
              </TitleLink>
            </Tooltip>
            {showFolderPath && (
              <Box sx={{ mt: 0.25 }}>
                <MapFolderPathBadge
                  folderPath={map.folderPath}
                  folderId={map.folderId}
                  onOpenFolder={onOpenFolder}
                  mb={0}
                />
              </Box>
            )}
          </Box>
        </MapRowTitleWrap>
      </BodyCell>
      <LabelsBodyCell>
        <LabelsCell
          labels={map.labels}
          onDelete={(label: Label) => onRemoveLabel(map.id, label.id)}
        />
      </LabelsBodyCell>
      <BodyCell>
        <CellText variant="body2" sx={{ whiteSpace: 'nowrap' }}>
          {formatMapSize(map.sizeBytes)}
        </CellText>
      </BodyCell>
      <BodyCell>
        <Tooltip
          arrow={true}
          title={date(displayTime).format('lll')}
          placement="bottom-start"
        >
          <CellText variant="body2">{date(displayTime).fromNow()}</CellText>
        </Tooltip>
      </BodyCell>
      <BodyCell padding="checkbox">
        <Tooltip
          arrow={true}
          title={intl.formatMessage({ id: 'maps.tooltip-starred', defaultMessage: 'Starred' })}
        >
          <ActionIconButton>
            <IconButton size="small" onClick={handleStar}>
              <StarIcon color="action" starred={map.starred} />
            </IconButton>
          </ActionIconButton>
        </Tooltip>
      </BodyCell>
      <BodyCell>
        <Tooltip
          arrow={true}
          title={intl.formatMessage({ id: 'map.more-actions', defaultMessage: 'More Actions' })}
        >
          <ActionIconButton>
            <IconButton
              aria-label={intl.formatMessage({ id: 'common.others', defaultMessage: 'Others' })}
              size="small"
              onClick={handleOpenMenu}
            >
              <GoogleIcon name="more_horiz" size={19} />
            </IconButton>
          </ActionIconButton>
        </Tooltip>
      </BodyCell>
    </TableRow>
  );
};

export const MapRow = memo(MapRowComponent);
