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
import Tooltip from '@mui/material/Tooltip';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import { MapInfo } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { useDate } from '../../../classes/app-i18n/dates';
import { buildMapEditPath } from '../../../utils/mapPath';
import { handleSpaLinkClick } from '../../../utils/appNavigation';
import { prefetchMapForOpen, preloadEditorResources } from '../../../utils/editorPreload';
import { formatMapSize } from '../../../utils/mapPreview';
import { GoogleIcon } from '../../common/google-symbol';
import type { MapItemHandlers } from './MapRow';
import { MapFolderPathBadge } from './MapFolderPathBadge';
import {
  ActionIconButton,
  CardLink,
  CardMetaText,
  CardSelectBox,
  CardTitle,
  CardTitleStack,
  CompactCardHeader,
  MapCardRoot,
  SelectCheckbox,
  StarIcon,
} from './styled';

interface MapCardProps extends MapItemHandlers {
  map: MapInfo;
  selected?: boolean;
  showFolderPath?: boolean;
  onToggleSelected?: (mapId: number) => void;
  onOpenFolder?: ((folderId: number) => void) | undefined;
}

/** A map on a narrow screen: the whole card opens the map in the editor. */
const MapCardComponent = ({
  map,
  selected = false,
  showFolderPath = true,
  onToggleSelected,
  onStar,
  onOpenMenu,
  onOpenFolder,
}: MapCardProps): React.ReactElement => {
  const intl = useIntl();
  const date = useDate();
  const client = use(ClientContext);
  const editPath = buildMapEditPath(map.folderPath, map.title);

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
              boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}33`,
            }
          : undefined
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {onToggleSelected && (
          <CardSelectBox>
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
          </CardSelectBox>
        )}
        <CardLink
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
                    <GoogleIcon name="more_vert" size={20} />
                  </IconButton>
                </ActionIconButton>
              </Tooltip>
            }
            // Not a Typography itself, so the header wraps it in its title Typography.
            title={
              <CardTitleStack>
                <CardTitle noWrap>{map.title}</CardTitle>
                {showFolderPath && (
                  <MapFolderPathBadge
                    folderPath={map.folderPath}
                    folderId={map.folderId}
                    onOpenFolder={onOpenFolder}
                    fontSize="0.72rem"
                    iconSize={12}
                    mb={0}
                  />
                )}
              </CardTitleStack>
            }
            subheader={
              <CardMetaText variant="subtitle2">
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
              </CardMetaText>
            }
          />
        </CardLink>
      </Box>
    </MapCardRoot>
  );
};

export const MapCard = memo(MapCardComponent);
