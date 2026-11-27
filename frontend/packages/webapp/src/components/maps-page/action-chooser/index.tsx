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
import { FormattedMessage } from 'react-intl';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import { GoogleIcon } from '../../common/google-symbol';
import { APPLE_FONT_STACK, RADIUS_LG, RADIUS_MD, appleColors, isDarkTheme } from '../appleDesign';

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
  anchorPosition?: { top: number; left: number } | undefined;
  mapId: number;
}

const ActionChooser = (props: ActionProps): React.ReactElement => {
  const { anchor, anchorPosition, onClose } = props;

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
      anchorEl={anchor ?? null}
      anchorReference={anchorPosition ? 'anchorPosition' : 'anchorEl'}
      {...(anchorPosition ? { anchorPosition } : {})}
      keepMounted
      open={Boolean(anchor) || Boolean(anchorPosition)}
      onClose={handleOnClose(undefined)}
      elevation={0}
      slotProps={{
        paper: {
          sx: (theme) => {
            const c = appleColors(isDarkTheme(theme));
            return {
              borderRadius: RADIUS_LG,
              border: 'none',
              boxShadow: c.shadowFloat,
              backgroundColor: isDarkTheme(theme) ? '#1C1C1E' : '#FFFFFF',
              fontFamily: APPLE_FONT_STACK,
              '& .MuiMenuItem-root': {
                fontWeight: 500,
                fontSize: '0.84rem',
                borderRadius: RADIUS_MD,
                margin: '2px 6px',
                minHeight: '34px',
                '&:hover': {
                  backgroundColor: c.hoverFill,
                },
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
      <MenuItem onClick={handleOnClose('open')} sx={{ width: '204px' }}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <GoogleIcon name="open_in_new" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.open" defaultMessage="Open" />
      </MenuItem>

      <Divider />

      <MenuItem onClick={handleOnClose('duplicate')}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <GoogleIcon name="content_copy" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.duplicate" defaultMessage="Duplicate" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('rename')}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <GoogleIcon name="edit" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.rename" defaultMessage="Rename" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('label')}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <GoogleIcon name="label" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.label" defaultMessage="Add Label" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('move-folder')}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <GoogleIcon name="drive_file_move" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.move-to-folder" defaultMessage="移动到文件夹" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('delete')} sx={{ color: 'error.main' }}>
        <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
          <GoogleIcon name="delete" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.delete" defaultMessage="Delete" />
      </MenuItem>
      <Divider />

      <MenuItem onClick={handleOnClose('export')}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <GoogleIcon name="download" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.export" defaultMessage="Export" />
      </MenuItem>

      <MenuItem onClick={handleOnClose('history')}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <GoogleIcon name="history" size={18} />
        </ListItemIcon>
        <FormattedMessage id="action.history" defaultMessage="History" />
      </MenuItem>
    </Menu>
  );
};

export default ActionChooser;
