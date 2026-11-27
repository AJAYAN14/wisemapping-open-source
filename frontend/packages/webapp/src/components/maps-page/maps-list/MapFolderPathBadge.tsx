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
import Box from '@mui/material/Box';
import { GoogleIcon } from '../../common/google-symbol';
import { APPLE_FONT_STACK, appleColors, isDarkTheme } from '../appleDesign';

interface MapFolderPathBadgeProps {
  folderPath?: string | undefined;
  folderId?: number | null | undefined;
  onOpenFolder?: ((folderId: number) => void) | undefined;
  fontSize?: string;
  iconSize?: number;
  mb?: number;
}

/**
 * Displays a map's parent folder path. When `folderId` and `onOpenFolder`
 * are provided, clicking it navigates directly to that folder in the folder browser.
 */
export const MapFolderPathBadge = ({
  folderPath,
  folderId,
  onOpenFolder,
  fontSize = '0.73rem',
  iconSize = 13,
  mb = 0.25,
}: MapFolderPathBadgeProps): React.ReactElement | null => {
  if (!folderPath) {
    return null;
  }

  const clickable = folderId !== null && folderId !== undefined && Boolean(onOpenFolder);

  return (
    <Box
      component={clickable ? 'button' : 'div'}
      type={clickable ? 'button' : undefined}
      onClick={
        clickable
          ? (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenFolder!(folderId!);
            }
          : undefined
      }
      sx={(theme) => {
        const c = appleColors(isDarkTheme(theme));
        return {
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize,
          fontWeight: 500,
          fontFamily: APPLE_FONT_STACK,
          color: c.textTertiary,
          lineHeight: 1.25,
          mb,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          ...(clickable
            ? {
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'color 120ms ease',
                '&:hover': {
                  color: c.amberText,
                },
              }
            : {}),
        };
      }}
    >
      <GoogleIcon name="folder" size={iconSize} filled />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{folderPath}</span>
    </Box>
  );
};
