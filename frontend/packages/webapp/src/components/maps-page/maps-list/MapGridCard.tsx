import React, { memo, use } from 'react';
import { useIntl } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import { MapInfo } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { useDate } from '../../../classes/app-i18n/dates';
import { buildMapEditPath } from '../../../utils/mapPath';
import { handleSpaLinkClick } from '../../../utils/appNavigation';
import { beginMapOpenTrace } from '../../../utils/mapOpenTiming';
import {
  cancelHoverPrefetchMapForOpen,
  prefetchMapForOpen,
  preloadEditorResources,
  scheduleHoverPrefetchMapForOpen,
} from '../../../utils/editorPreload';
import { formatMapSize } from '../../../utils/mapPreview';
import { GoogleIcon } from '../../common/google-symbol';
import type { MapItemHandlers } from './MapRow';
import { MapFolderPathBadge } from './MapFolderPathBadge';
import { MindmapMiniPreview } from './MindmapMiniPreview';
import {
  ActionIconButton,
  GridCardActionsOverlay,
  GridCardBody,
  GridCardCheckboxOverlay,
  GridCardFolderSlot,
  GridCardLink,
  GridCardMeta,
  GridCardPreview,
  GridCardRoot,
  GridCardTitle,
  GridMetaSize,
  GridMetaTime,
  SelectCheckbox,
  StarIcon,
} from './styled';

interface MapGridCardProps extends MapItemHandlers {
  map: MapInfo;
  selected: boolean;
  hasAnySelected: boolean;
  timeField?: 'lastModificationTime' | 'lastOpenTime';
  showFolderPath?: boolean;
  onToggleSelected: (mapId: number) => void;
  onOpenFolder?: ((folderId: number) => void) | undefined;
  onContextMenu?: (mapId: number, event: React.MouseEvent<HTMLDivElement>) => void;
  onDragStart?: (mapId: number, event: React.DragEvent<HTMLDivElement>) => void;
}

const MapGridCardComponent = ({
  map,
  selected,
  hasAnySelected,
  timeField = 'lastModificationTime',
  showFolderPath = true,
  onToggleSelected,
  onStar,
  onOpenMenu,
  onOpenFolder,
  onContextMenu,
  onDragStart,
}: MapGridCardProps): React.ReactElement => {
  const intl = useIntl();
  const date = useDate();
  const client = use(ClientContext);
  const editPath = buildMapEditPath(map.folderPath, map.title);

  const displayTime =
    timeField === 'lastOpenTime'
      ? (map.lastOpenTime ?? map.lastModificationTime)
      : map.lastModificationTime;
  const timeText =
    timeField === 'lastOpenTime'
      ? `打开于 ${date(displayTime).fromNow()}`
      : date(displayTime).fromNow();

  const handleStar = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    onStar(map.id, !map.starred);
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onOpenMenu(map.id, event.currentTarget);
  };

  const handleCheckboxClick = (event: React.MouseEvent): void => {
    event.stopPropagation();
  };

  return (
    <GridCardRoot
      selected={selected}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart ? (e) => onDragStart(map.id, e) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(map.id, e) : undefined}
    >
      <GridCardLink
        href={editPath}
        underline="none"
        onMouseEnter={() => {
          void preloadEditorResources();
          scheduleHoverPrefetchMapForOpen(client, map.folderPath ?? '', map.title);
        }}
        onMouseLeave={() => {
          cancelHoverPrefetchMapForOpen(map.folderPath ?? '', map.title);
        }}
        onFocus={() => {
          void preloadEditorResources();
        }}
        onPointerDown={() => {
          prefetchMapForOpen(client, map.folderPath ?? '', map.title);
        }}
        onClick={(e) => {
          beginMapOpenTrace(editPath, map.title, 'list-click');
          handleSpaLinkClick(e, editPath, false);
        }}
      >
        <GridCardPreview>
          <MindmapMiniPreview preview={map.preview} title={map.title} />

          <GridCardCheckboxOverlay
            className="grid-card-overlay"
            visible={selected || hasAnySelected}
            onClick={handleCheckboxClick}
          >
            <SelectCheckbox
              checked={selected}
              onChange={() => onToggleSelected(map.id)}
              size="small"
              icon={<CheckBoxOutlineBlankRoundedIcon fontSize="small" />}
              checkedIcon={<CheckBoxRoundedIcon fontSize="small" />}
              slotProps={{
                input: {
                  'aria-label': intl.formatMessage(
                    { id: 'maps.select-map', defaultMessage: 'Select {title}' },
                    { title: map.title },
                  ),
                },
              }}
            />
          </GridCardCheckboxOverlay>

          <GridCardActionsOverlay className="grid-card-overlay" alwaysVisibleStar={map.starred}>
            <Tooltip
              arrow={true}
              title={intl.formatMessage({ id: 'maps.tooltip-starred', defaultMessage: 'Starred' })}
            >
              <ActionIconButton>
                <IconButton
                  size="small"
                  className={map.starred ? 'grid-star-active' : undefined}
                  aria-label={intl.formatMessage({
                    id: 'maps.tooltip-starred',
                    defaultMessage: 'Starred',
                  })}
                  onClick={handleStar}
                >
                  <StarIcon color="action" starred={map.starred} fontSize="small" />
                </IconButton>
              </ActionIconButton>
            </Tooltip>

            <Tooltip
              arrow={true}
              title={intl.formatMessage({ id: 'map.more-actions', defaultMessage: 'More Actions' })}
            >
              <ActionIconButton>
                <IconButton
                  size="small"
                  aria-label={intl.formatMessage({ id: 'common.others', defaultMessage: 'Others' })}
                  onClick={handleOpenMenu}
                >
                  <GoogleIcon name="more_horiz" size={18} />
                </IconButton>
              </ActionIconButton>
            </Tooltip>
          </GridCardActionsOverlay>
        </GridCardPreview>

        <GridCardBody>
          <Tooltip title={map.title} enterDelay={500} placement="top-start">
            <GridCardTitle>{map.title}</GridCardTitle>
          </Tooltip>

          {showFolderPath && map.folderPath ? (
            <GridCardFolderSlot>
              <MapFolderPathBadge
                folderPath={map.folderPath}
                folderId={map.folderId}
                onOpenFolder={onOpenFolder}
                fontSize="0.72rem"
                iconSize={12}
                mb={0}
              />
            </GridCardFolderSlot>
          ) : null}

          <GridCardMeta>
            <Tooltip
              arrow={true}
              title={date(displayTime).format('lll')}
              placement="bottom-start"
            >
              <GridMetaTime>{timeText}</GridMetaTime>
            </Tooltip>
            <GridMetaSize>{formatMapSize(map.sizeBytes)}</GridMetaSize>
          </GridCardMeta>
        </GridCardBody>
      </GridCardLink>
    </GridCardRoot>
  );
};

export const MapGridCard = memo(MapGridCardComponent);
