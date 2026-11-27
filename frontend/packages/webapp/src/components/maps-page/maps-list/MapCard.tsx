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
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { MapInfo } from '../../../classes/client';
import { useDate } from '../../../classes/app-i18n/dates';
import { buildMapEditPath } from '../../../utils/mapPath';
import { formatMapSize } from '../../../utils/mapPreview';
import type { MapItemHandlers } from './MapRow';
import {
  ActionIconButton,
  CardTitle,
  CompactCardHeader,
  MapCardRoot,
  SelectCheckbox,
  StarIcon,
} from './styled';

interface MapCardProps extends MapItemHandlers {
  map: MapInfo;
  selected?: boolean;
  onToggleSelected?: (mapId: number) => void;
}

/** A map on a narrow screen: the whole card opens the map in the editor. */
const MapCardComponent = ({
  map,
  selected = false,
  onToggleSelected,
  onStar,
  onOpenMenu,
}: MapCardProps): React.ReactElement => {
  const intl = useIntl();
  const date = useDate();

  // Both buttons sit inside the card's link: neither may follow it.
  const handleStar = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    onStar(map.id, !map.starred);
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
    onOpenMenu(map.id, event.currentTarget);
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <MapCardRoot
      elevation={0}
      sx={
        selected
          ? {
              borderColor: 'primary.main',
              boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}33`,
            }
          : undefined
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {onToggleSelected && (
          <Box sx={{ pl: 0.5, flexShrink: 0 }}>
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
          </Box>
        )}
        <Link
          href={buildMapEditPath(map.folderPath, map.title)}
          underline="none"
          onClick={(e) => e.stopPropagation()}
          sx={{ flex: 1, minWidth: 0, display: 'block' }}
        >
          <CompactCardHeader
            avatar={
              <Tooltip
                arrow={true}
                title={intl.formatMessage({
                  id: 'maps.tooltip-starred',
                  defaultMessage: 'Starred',
                })}
              >
                <ActionIconButton>
                  <IconButton
                    size="small"
                    aria-label={intl.formatMessage({
                      id: 'maps.tooltip-starred',
                      defaultMessage: 'Starred',
                    })}
                    onClick={handleStar}
                  >
                    <StarIcon color="action" starred={map.starred} />
                  </IconButton>
                </ActionIconButton>
              </Tooltip>
            }
            action={
              <Tooltip
                arrow={true}
                title={intl.formatMessage({
                  id: 'map.more-actions',
                  defaultMessage: 'More Actions',
                })}
              >
                <ActionIconButton>
                  <IconButton
                    aria-label={intl.formatMessage({
                      id: 'common.settings',
                      defaultMessage: 'Settings',
                    })}
                    onClick={handleOpenMenu}
                  >
                    <MoreVertRoundedIcon color="action" />
                  </IconButton>
                </ActionIconButton>
              </Tooltip>
            }
            // Not a Typography itself, so the header wraps it in its title Typography.
            title={
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {map.folderPath && (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.4,
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      color: 'text.secondary',
                      opacity: 0.85,
                      mb: 0.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <FolderRoundedIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                    <span>{map.folderPath}</span>
                  </Box>
                )}
                <CardTitle noWrap>{map.title}</CardTitle>
              </Box>
            }
            subheader={
              <Typography
                variant="subtitle2"
                sx={{ fontSize: '0.76rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {intl.formatMessage({ id: 'map.last-update', defaultMessage: 'Last Update' })}
                <span>: </span>
                <Tooltip
                  arrow={true}
                  title={date(map.lastModificationTime).format('lll')}
                  placement="bottom-start"
                >
                  <span>{date(map.lastModificationTime).fromNow()}</span>
                </Tooltip>
                {typeof map.sizeBytes === 'number' && (
                  <span> · {formatMapSize(map.sizeBytes)}</span>
                )}
              </Typography>
            }
          />
        </Link>
      </Box>
    </MapCardRoot>
  );
};

export const MapCard = memo(MapCardComponent);
