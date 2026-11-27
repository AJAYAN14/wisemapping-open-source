import React, { memo } from 'react';
import { useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { MapInfo } from '../../../classes/client';
import { useDate } from '../../../classes/app-i18n/dates';
import { buildMapEditPath } from '../../../utils/mapPath';
import { formatMapSize } from '../../../utils/mapPreview';
import type { MapItemHandlers } from './MapRow';
import { MindmapMiniPreview } from './MindmapMiniPreview';
import {
  ActionIconButton,
  GridCardActionsOverlay,
  GridCardBody,
  GridCardCheckboxOverlay,
  GridCardMeta,
  GridCardPreview,
  GridCardRoot,
  GridCardTitle,
  SelectCheckbox,
  StarIcon,
} from './styled';

interface MapGridCardProps extends MapItemHandlers {
  map: MapInfo;
  selected: boolean;
  hasAnySelected: boolean;
  timeField?: 'lastModificationTime' | 'lastOpenTime';
  onToggleSelected: (mapId: number) => void;
  onContextMenu?: (mapId: number, event: React.MouseEvent<HTMLDivElement>) => void;
  onDragStart?: (mapId: number, event: React.DragEvent<HTMLDivElement>) => void;
}

const MapGridCardComponent = ({
  map,
  selected,
  hasAnySelected,
  timeField = 'lastModificationTime',
  onToggleSelected,
  onStar,
  onOpenMenu,
  onContextMenu,
  onDragStart,
}: MapGridCardProps): React.ReactElement => {
  const intl = useIntl();
  const date = useDate();

  const displayTime =
    timeField === 'lastOpenTime'
      ? (map.lastOpenTime ?? map.lastModificationTime)
      : map.lastModificationTime;
  const timeLabelPrefix = timeField === 'lastOpenTime' ? '最近打开' : '最近修改';

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
      <Link
        href={buildMapEditPath(map.folderPath, map.title)}
        underline="none"
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'inherit' }}
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
                  <MoreHorizRoundedIcon color="action" fontSize="small" />
                </IconButton>
              </ActionIconButton>
            </Tooltip>
          </GridCardActionsOverlay>
        </GridCardPreview>

        <GridCardBody>
          {map.folderPath && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'text.secondary',
                opacity: 0.82,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              <FolderRoundedIcon sx={{ fontSize: 12, opacity: 0.75, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {map.folderPath}
              </span>
            </Box>
          )}

          <Tooltip title={map.title} enterDelay={500} placement="top-start">
            <GridCardTitle>{map.title}</GridCardTitle>
          </Tooltip>

          <GridCardMeta>
            <Tooltip
              arrow={true}
              title={date(displayTime).format('lll')}
              placement="bottom-start"
            >
              <Typography
                component="span"
                variant="caption"
                sx={{
                  fontSize: 'inherit',
                  fontWeight: 'inherit',
                  color: 'inherit',
                  fontVariantNumeric: 'tabular-nums',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {timeLabelPrefix}: {date(displayTime).fromNow()}
              </Typography>
            </Tooltip>
            <Typography
              component="span"
              variant="caption"
              sx={{
                fontSize: 'inherit',
                fontWeight: 600,
                color: 'inherit',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {formatMapSize(map.sizeBytes)}
            </Typography>
          </GridCardMeta>
        </GridCardBody>
      </Link>
    </GridCardRoot>
  );
};

export const MapGridCard = memo(MapGridCardComponent);
