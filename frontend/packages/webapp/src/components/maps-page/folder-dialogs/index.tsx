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
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import FormControl from '@mui/material/FormControl';
import Typography from '@mui/material/Typography';
import BaseDialog from '../action-dispatcher/base-dialog';
import Input from '../../form/input';
import { ErrorInfo, FOLDER_NAME_MAX_LENGTH, Folder, MapInfo } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { getDescendantFolderIds, getFolderBreadcrumbs } from '../folderTree';
import { FolderTreePicker } from './FolderTreePicker';

export type FolderCreateDialogProps = {
  parentId: number | null;
  parentName?: string | undefined;
  onClose: () => void;
  onCreated?: (folder: Folder) => void;
};

export const FolderCreateDialog = ({
  parentId,
  parentName,
  onClose,
  onCreated,
}: FolderCreateDialogProps): React.ReactElement => {
  const intl = useIntl();
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<ErrorInfo>();

  const mutation = useMutation<Folder, ErrorInfo, string>({
    mutationFn: (folderName) => {
      if (!client.createFolder) {
        return Promise.reject({ msg: 'Create folder is not supported.' });
      }
      return client.createFolder(folderName, parentId);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      onCreated?.(created);
      onClose();
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError({ fields: { name: '文件夹名称不能为空。' } });
      return;
    }
    if (/[\\/]/.test(trimmed)) {
      setError({ fields: { name: '文件夹名称不能包含斜杠（/ 或 \\）。' } });
      return;
    }
    setError(undefined);
    mutation.mutate(trimmed);
  };

  return (
    <BaseDialog
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isLoading={mutation.isPending}
      title={intl.formatMessage({
        id: parentId === null ? 'folder.create-title' : 'folder.new-subfolder',
        defaultMessage: parentId === null ? '新建文件夹' : '新建子文件夹',
      })}
      description={
        parentName
          ? `将在“${parentName}”下创建子文件夹。`
          : intl.formatMessage({
              id: 'folder.create-description',
              defaultMessage: '请输入文件夹名称。',
            })
      }
      submitButton={intl.formatMessage({
        id: 'folder.create-button',
        defaultMessage: '创建',
      })}
      maxWidth="xs"
    >
      <FormControl fullWidth>
        <Input
          name="name"
          type="text"
          label={intl.formatMessage({
            id: 'folder.name-placeholder',
            defaultMessage: '文件夹名称',
          })}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          error={error}
          fullWidth
          autoFocus
          maxLength={FOLDER_NAME_MAX_LENGTH}
        />
      </FormControl>
    </BaseDialog>
  );
};

export type FolderRenameDialogProps = {
  folder: Folder;
  onClose: () => void;
};

export const FolderRenameDialog = ({
  folder,
  onClose,
}: FolderRenameDialogProps): React.ReactElement => {
  const intl = useIntl();
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<ErrorInfo>();

  const mutation = useMutation<Folder, ErrorInfo, string>({
    mutationFn: (nextName) => {
      if (!client.updateFolder) {
        return Promise.reject({ msg: 'Rename folder is not supported.' });
      }
      return client.updateFolder(folder.id, { name: nextName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      onClose();
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError({ fields: { name: '文件夹名称不能为空。' } });
      return;
    }
    if (/[\\/]/.test(trimmed)) {
      setError({ fields: { name: '文件夹名称不能包含斜杠（/ 或 \\）。' } });
      return;
    }
    if (trimmed === folder.name) {
      onClose();
      return;
    }
    setError(undefined);
    mutation.mutate(trimmed);
  };

  return (
    <BaseDialog
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isLoading={mutation.isPending}
      title={intl.formatMessage({
        id: 'folder.rename-title',
        defaultMessage: '重命名文件夹',
      })}
      description={intl.formatMessage({
        id: 'folder.rename-description',
        defaultMessage: '请输入新的文件夹名称。',
      })}
      submitButton={intl.formatMessage({
        id: 'folder.rename-button',
        defaultMessage: '保存',
      })}
      maxWidth="xs"
    >
      <FormControl fullWidth>
        <Input
          name="name"
          type="text"
          label={intl.formatMessage({
            id: 'folder.name-placeholder',
            defaultMessage: '文件夹名称',
          })}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          error={error}
          fullWidth
          autoFocus
          maxLength={FOLDER_NAME_MAX_LENGTH}
        />
      </FormControl>
    </BaseDialog>
  );
};

export type FolderDeleteDialogProps = {
  folder?: Folder | undefined;
  foldersToDelete?: Folder[] | undefined;
  onClose: (success?: boolean) => void;
  onDeleted?: ((deletedFolderIds: number[]) => void) | undefined;
};

export const FolderDeleteDialog = ({
  folder,
  foldersToDelete,
  onClose,
  onDeleted,
}: FolderDeleteDialogProps): React.ReactElement => {
  const intl = useIntl();
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const [error, setError] = useState<ErrorInfo>();

  const targetFolders = useMemo(
    () => (foldersToDelete && foldersToDelete.length > 0 ? foldersToDelete : folder ? [folder] : []),
    [folder, foldersToDelete],
  );
  const isBatch = targetFolders.length > 1;

  const mutation = useMutation<number[], ErrorInfo>({
    mutationFn: async () => {
      if (!client.deleteFolder) {
        return Promise.reject({ msg: 'Delete folder is not supported.' });
      }
      const deletedIds: number[] = [];
      for (const item of targetFolders) {
        await client.deleteFolder(item.id);
        deletedIds.push(item.id);
      }
      return deletedIds;
    },
    onSuccess: (deletedIds) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      onDeleted?.(deletedIds);
      onClose(true);
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (targetFolders.length === 0) {
      onClose(false);
      return;
    }
    setError(undefined);
    mutation.mutate();
  };

  return (
    <BaseDialog
      onClose={() => onClose(false)}
      onSubmit={handleSubmit}
      error={error}
      isLoading={mutation.isPending}
      title={intl.formatMessage({
        id: 'folder.delete-title',
        defaultMessage: '确认删除文件夹',
      })}
      submitButton={intl.formatMessage({
        id: 'action.delete-title',
        defaultMessage: '删除',
      })}
      maxWidth="xs"
    >
      <Alert severity="warning">
        <AlertTitle>
          <Typography component="span" sx={{ fontWeight: 'bold' }}>
            {isBatch ? `将删除 ${targetFolders.length} 个文件夹` : (targetFolders[0]?.name ?? '')}
          </Typography>
        </AlertTitle>
        {isBatch ? (
          '删除后，这些文件夹内的导图和子文件夹将自动移回根目录，不会删除导图本身。'
        ) : (
          <FormattedMessage
            id="folder.delete-description"
            defaultMessage="删除后，该文件夹内的导图和子文件夹将自动移回根目录，不会删除导图本身。"
          />
        )}
      </Alert>
    </BaseDialog>
  );
};

export type FolderMoveResult = {
  targetFolderId: number | null;
  movedFolders: Folder[];
  movedMapsCount: number;
};

export type FolderMoveDialogProps = {
  folder?: Folder | undefined;
  foldersToMove?: Folder[] | undefined;
  mapsToMove?: MapInfo[] | undefined;
  folders: Folder[];
  onClose: (success?: boolean) => void;
  onMoved?: ((result: FolderMoveResult) => void) | undefined;
};

export const FolderMoveDialog = ({
  folder,
  foldersToMove,
  mapsToMove,
  folders,
  onClose,
  onMoved,
}: FolderMoveDialogProps): React.ReactElement => {
  const intl = useIntl();
  const client = use(ClientContext);
  const queryClient = useQueryClient();

  const targetFolders = useMemo(
    () => (foldersToMove && foldersToMove.length > 0 ? foldersToMove : folder ? [folder] : []),
    [folder, foldersToMove],
  );
  const targetMaps = useMemo(() => mapsToMove ?? [], [mapsToMove]);

  const disabledIds = useMemo(() => {
    const disabled = new Set<number>();
    for (const item of targetFolders) {
      for (const descendantId of getDescendantFolderIds(folders, item.id)) {
        disabled.add(descendantId);
      }
    }
    return disabled;
  }, [folders, targetFolders]);

  const initialParentId = useMemo(() => {
    const parentCandidates = new Set<number | null>([
      ...targetFolders.map((item) => item.parentId ?? null),
      ...targetMaps.map((item) => item.folderId ?? null),
    ]);
    if (parentCandidates.size === 1) {
      const onlyParent = Array.from(parentCandidates)[0] ?? null;
      if (onlyParent === null || !disabledIds.has(onlyParent)) {
        return onlyParent;
      }
    }
    return null;
  }, [targetFolders, targetMaps, disabledIds]);

  const initialExpandedIds = useMemo(() => {
    if (initialParentId === null) {
      return new Set<number>();
    }
    const chain = getFolderBreadcrumbs(folders, initialParentId);
    return new Set(chain.map((item) => item.id));
  }, [folders, initialParentId]);

  const [selectedParentId, setSelectedParentId] = useState<number | null>(initialParentId);
  const [inlineCreatedFolders, setInlineCreatedFolders] = useState<Folder[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo>();

  const mergedFolders = useMemo(() => {
    if (inlineCreatedFolders.length === 0) {
      return folders;
    }
    const existingIds = new Set(folders.map((item) => item.id));
    const extras = inlineCreatedFolders.filter((item) => !existingIds.has(item.id));
    return extras.length > 0 ? [...folders, ...extras] : folders;
  }, [folders, inlineCreatedFolders]);

  const mutation = useMutation<FolderMoveResult, ErrorInfo, number | null>({
    mutationFn: async (parentId) => {
      const foldersNeedMove = targetFolders.filter(
        (item) => (item.parentId ?? null) !== parentId,
      );
      const mapsNeedMove = targetMaps.filter((item) => (item.folderId ?? null) !== parentId);

      if (foldersNeedMove.length > 0) {
        const folderIds = foldersNeedMove.map((item) => item.id);
        if (client.moveFoldersToFolder) {
          await client.moveFoldersToFolder(folderIds, parentId);
        } else if (client.updateFolder) {
          for (const item of foldersNeedMove) {
            await client.updateFolder(item.id, { parentId });
          }
        } else {
          return Promise.reject({ msg: 'Move folder is not supported.' });
        }
      }

      if (mapsNeedMove.length > 0) {
        if (!client.moveMapsToFolder) {
          return Promise.reject({ msg: 'Move to folder is not supported.' });
        }
        await client.moveMapsToFolder(
          mapsNeedMove.map((item) => item.id),
          parentId,
        );
      }

      return {
        targetFolderId: parentId,
        movedFolders: foldersNeedMove,
        movedMapsCount: mapsNeedMove.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      onMoved?.(result);
      onClose(true);
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasChanges =
      targetFolders.some((item) => (item.parentId ?? null) !== selectedParentId) ||
      targetMaps.some((item) => (item.folderId ?? null) !== selectedParentId);
    if (!hasChanges) {
      onClose(false);
      return;
    }
    setError(undefined);
    mutation.mutate(selectedParentId);
  };

  const description = useMemo(() => {
    if (targetFolders.length === 1 && targetMaps.length === 0) {
      return `选择“${targetFolders[0]!.name}”的新上级目录，或先在下方新建文件夹。`;
    }
    if (targetFolders.length > 1 && targetMaps.length === 0) {
      return `已选择 ${targetFolders.length} 个文件夹，选择目标文件夹，或先在下方新建文件夹。`;
    }
    if (targetFolders.length > 0 && targetMaps.length > 0) {
      return `已选择 ${targetFolders.length} 个文件夹、${targetMaps.length} 份导图，选择目标文件夹，或先在下方新建文件夹。`;
    }
    return '选择目标文件夹，或先在下方新建文件夹。';
  }, [targetFolders, targetMaps.length]);

  return (
    <BaseDialog
      onClose={() => onClose(false)}
      onSubmit={handleSubmit}
      error={error}
      isLoading={mutation.isPending || pickerLoading}
      title={intl.formatMessage({
        id: 'folder.move-folder-title',
        defaultMessage: '调整文件夹位置',
      })}
      description={description}
      submitButton={intl.formatMessage({
        id: 'folder.move-button',
        defaultMessage: '移动到此处',
      })}
      maxWidth="xs"
    >
      <FolderTreePicker
        folders={mergedFolders}
        selectedFolderId={selectedParentId}
        onSelectFolder={setSelectedParentId}
        disabledIds={disabledIds}
        initialExpandedIds={initialExpandedIds}
        allowInlineCreate
        ariaLabel={intl.formatMessage({
          id: 'folder.move-folder-title',
          defaultMessage: '调整文件夹位置',
        })}
        onError={setError}
        onLoadingChange={setPickerLoading}
        onFolderCreated={(created) =>
          setInlineCreatedFolders((prev) =>
            prev.some((item) => item.id === created.id) ? prev : [...prev, created],
          )
        }
      />
    </BaseDialog>
  );
};
