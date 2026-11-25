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

import React, { use, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import FormControl from '@mui/material/FormControl';
import Typography from '@mui/material/Typography';
import BaseDialog from '../action-dispatcher/base-dialog';
import Input from '../../form/input';
import { ErrorInfo, FOLDER_NAME_MAX_LENGTH, Folder } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';

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
          maxLength={FOLDER_NAME_MAX_LENGTH}
        />
      </FormControl>
    </BaseDialog>
  );
};

export type FolderDeleteDialogProps = {
  folder: Folder;
  onClose: () => void;
  onDeleted?: (deletedFolderId: number) => void;
};

export const FolderDeleteDialog = ({
  folder,
  onClose,
  onDeleted,
}: FolderDeleteDialogProps): React.ReactElement => {
  const intl = useIntl();
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const [error, setError] = useState<ErrorInfo>();

  const mutation = useMutation<void, ErrorInfo>({
    mutationFn: () => {
      if (!client.deleteFolder) {
        return Promise.reject({ msg: 'Delete folder is not supported.' });
      }
      return client.deleteFolder(folder.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      onDeleted?.(folder.id);
      onClose();
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    mutation.mutate();
  };

  return (
    <BaseDialog
      onClose={onClose}
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
            {folder.name}
          </Typography>
        </AlertTitle>
        <FormattedMessage
          id="folder.delete-description"
          defaultMessage="删除后，该文件夹内的导图和子文件夹将自动移回根目录，不会删除导图本身。"
        />
      </Alert>
    </BaseDialog>
  );
};
