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

import React from 'react';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FileCopyRoundedIcon from '@mui/icons-material/FileCopyRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import DriveFileMoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';

import { FormattedMessage } from 'react-intl';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import { APPLE_FONT_STACK, appleColors, isDarkTheme } from '../appleDesign';

export type ActionType =
  | 'open'
  | 'delete'
  | 'create'
  | 'duplicate'
  | 'export'
  | 'label'
  | 'move-folder'
  | 'rename'
  | 'history'
  | 'back'
  | undefined;

interface ActionProps {
  onClose: (action: ActionType) => void;
  anchor?: HTMLElement | undefined;
  mapId: number;
}

const ActionChooser = (props: ActionProps): React.ReactElement => {
  const { anchor, onClose } = props;

  const handleOnClose = (
    action: ActionType,
  ): ((event: React.MouseEvent<HTMLLIElement>) => void) => {
    return (event): void => {
      event.stopPropagation();
      onClose(action);
    };
  };

  return (
    <Menu
      anchorEl={anchor}
      keepMounted
      open={Boolean(anchor)}
      onClose={handleOnClose(undefined)}
      elevation={0}
      slotProps={{
        paper: {
          sx: (theme) => {
            const c = appleColors(isDarkTheme(theme));
            return {
              borderRadius: '14px',
              border: `1px solid ${c.hairline}`,
              boxShadow: c.shadowFloat,
              backgroundColor: c.headerGlass,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              fontFamily: APPLE_FONT_STACK,
              '& .MuiMenuItem-root': {
                fontWeight: 600,
                fontSize: '0.88rem',
                borderRadius: '8px',
                margin: '2px 6px',
              },
              '@media (prefers-reduced-transparency: reduce)': {
                backgroundColor: c.surface,
                backdropFilter: 'none',
              },
            };
          },
        },
      }}
    >
      <MenuItem onClick={handleOnClose('open')} sx={{ width: '216px' }}>
        <ListItemIcon>
          <DescriptionRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.open" defaultMessage="Open" />
      </MenuItem>

      <Divider />

      <MenuItem onClick={handleOnClose('duplicate')}>
        <ListItemIcon>
          <FileCopyRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.duplicate" defaultMessage="Duplicate" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('rename')}>
        <ListItemIcon>
          <EditRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.rename" defaultMessage="Rename" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('label')}>
        <ListItemIcon>
          <LabelRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.label" defaultMessage="Add Label" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('move-folder')}>
        <ListItemIcon>
          <DriveFileMoveRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.move-to-folder" defaultMessage="移动到文件夹" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('delete')} sx={{ color: 'error.main' }}>
        <ListItemIcon sx={{ color: 'inherit' }}>
          <DeleteRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.delete" defaultMessage="Delete" />
      </MenuItem>
      <Divider />

      <MenuItem onClick={handleOnClose('export')}>
        <ListItemIcon>
          <CloudDownloadRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.export" defaultMessage="Export" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('history')}>
        <ListItemIcon>
          <HistoryRoundedIcon fontSize="small" />
        </ListItemIcon>
        <FormattedMessage id="action.history" defaultMessage="History" />
      </MenuItem>
    </Menu>
  );
};

export default ActionChooser;
