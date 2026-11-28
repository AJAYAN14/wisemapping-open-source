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

import React, { use, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BaseDialog from '../base-dialog';
import { ErrorInfo, Folder, MapInfo } from '../../../../classes/client';
import { ClientContext } from '../../../../classes/provider/client-context';
import { MultiDialogProps, handleOnMutationSuccess } from '..';
import { APPLE_FONT_STACK } from '../../appleDesign';
import { FolderTreePicker } from '../../folder-dialogs/FolderTreePicker';

const NO_FOLDERS: Folder[] = [];

const MoveFolderDialog = ({ mapsId, onClose }: MultiDialogProps): React.ReactElement => {
  const intl = useIntl();
  const client = use(ClientContext);
  const queryClient = useQueryClient();

  const { data: maps = [] } = useQuery<unknown, ErrorInfo, MapInfo[]>({
    queryKey: ['maps'],
    queryFn: () => client.fetchAllMaps(),
  });

  const { data: folders = NO_FOLDERS } = useQuery<unknown, ErrorInfo, Folder[]>({
    queryKey: ['folders'],
    queryFn: () => (client.fetchFolders ? client.fetchFolders() : Promise.resolve([])),
  });

  const targetMaps = useMemo(() => maps.filter((m) => mapsId.includes(m.id)), [maps, mapsId]);
  const initialFolderId =
    targetMaps.length === 1 ? (targetMaps[0]?.folderId ?? null) : null;

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(initialFolderId);
  const [hasUserPicked, setHasUserPicked] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo>();

  const effectiveSelectedId = hasUserPicked ? selectedFolderId : initialFolderId;

  const moveMutation = useMutation<void, ErrorInfo, number | null>({
    mutationFn: (folderId) => {
      if (!client.moveMapsToFolder) {
        return Promise.reject({ msg: 'Move to folder is not supported.' });
      }
      return client.moveMapsToFolder(mapsId, folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      handleOnMutationSuccess(() => onClose(true), queryClient);
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    moveMutation.mutate(effectiveSelectedId);
  };

  return (
    <BaseDialog
      onClose={() => onClose(false)}
      onSubmit={handleSubmit}
      error={error}
      isLoading={moveMutation.isPending || pickerLoading}
      title={intl.formatMessage({
        id: 'folder.move-title',
        defaultMessage: '移动到文件夹',
      })}
      description={intl.formatMessage({
        id: 'folder.move-description',
        defaultMessage: '选择目标文件夹，或先在下方新建文件夹。',
      })}
      submitButton={intl.formatMessage({
        id: 'folder.move-button',
        defaultMessage: '移动到此处',
      })}
      maxWidth="xs"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {targetMaps.length > 0 && (
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: 'text.secondary', fontFamily: APPLE_FONT_STACK }}
          >
            {targetMaps.length > 1
              ? `已选择 ${targetMaps.length} 份导图`
              : `导图：${targetMaps[0]?.title}`}
          </Typography>
        )}

        <FolderTreePicker
          folders={folders}
          selectedFolderId={effectiveSelectedId}
          onSelectFolder={(folderId) => {
            setSelectedFolderId(folderId);
            setHasUserPicked(true);
          }}
          allowInlineCreate
          ariaLabel={intl.formatMessage({
            id: 'folder.move-title',
            defaultMessage: '移动到文件夹',
          })}
          onError={setError}
          onLoadingChange={setPickerLoading}
        />
      </Box>
    </BaseDialog>
  );
};

export default MoveFolderDialog;
