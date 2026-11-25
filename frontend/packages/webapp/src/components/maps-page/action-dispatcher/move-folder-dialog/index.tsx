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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import BaseDialog from '../base-dialog';
import { ErrorInfo, FOLDER_NAME_MAX_LENGTH, Folder, MapInfo } from '../../../../classes/client';
import { ClientContext } from '../../../../classes/provider/client-context';
import { MultiDialogProps, handleOnMutationSuccess } from '..';
import { FolderTreeNode, buildFolderTree } from '../../folderTree';
import { APPLE_FONT_STACK, appleColors, applePressMixin, isDarkTheme } from '../../appleDesign';

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
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [creatingInline, setCreatingInline] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState<ErrorInfo>();

  const effectiveSelectedId = hasUserPicked ? selectedFolderId : initialFolderId;
  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

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

  const createFolderMutation = useMutation<Folder, ErrorInfo, { name: string; parentId: number | null }>({
    mutationFn: ({ name, parentId }) => {
      if (!client.createFolder) {
        return Promise.reject({ msg: 'Create folder is not supported.' });
      }
      return client.createFolder(name, parentId);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      if (created.parentId !== null) {
        setExpandedIds((prev) => new Set(prev).add(created.parentId!));
      }
      setSelectedFolderId(created.id);
      setHasUserPicked(true);
      setNewFolderName('');
      setCreatingInline(false);
      setError(undefined);
    },
    onError: (err) => setError(err),
  });

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    moveMutation.mutate(effectiveSelectedId);
  };

  const handleCreateInlineFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setError({ msg: '文件夹名称不能为空。' });
      return;
    }
    setError(undefined);
    createFolderMutation.mutate({ name: trimmed, parentId: effectiveSelectedId });
  };

  const renderNode = (node: FolderTreeNode): React.ReactNode => {
    const { folder, children, depth } = node;
    const isSelected = effectiveSelectedId === folder.id;
    const isExpanded = expandedIds.has(folder.id);
    const hasChildren = children.length > 0;

    return (
      <React.Fragment key={folder.id}>
        <Box
          role="option"
          aria-selected={isSelected}
          onClick={() => {
            setSelectedFolderId(folder.id);
            setHasUserPicked(true);
            setError(undefined);
          }}
          sx={(theme) => {
            const c = appleColors(isDarkTheme(theme));
            return {
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pl: `${10 + depth * 18}px`,
              pr: '10px',
              py: '7px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: APPLE_FONT_STACK,
              fontSize: '0.88rem',
              fontWeight: isSelected ? 700 : 600,
              color: isSelected ? c.amberText : c.textPrimary,
              backgroundColor: isSelected ? c.amberSoft : 'transparent',
              ...applePressMixin,
              '&:hover': {
                backgroundColor: isSelected ? c.amberSoftHover : c.hoverFill,
              },
            };
          }}
        >
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={(e) => toggleExpand(folder.id, e)}
              sx={{ p: '2px', color: 'inherit' }}
              aria-label={isExpanded ? '折叠子文件夹' : '展开子文件夹'}
            >
              {isExpanded ? (
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <KeyboardArrowRightRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          ) : (
            <Box sx={{ width: 22, flexShrink: 0 }} />
          )}
          {isSelected || isExpanded ? (
            <FolderOpenRoundedIcon sx={{ fontSize: 18, color: isSelected ? 'inherit' : '#F59E0B', flexShrink: 0 }} />
          ) : (
            <FolderRoundedIcon sx={{ fontSize: 18, color: '#F59E0B', opacity: 0.85, flexShrink: 0 }} />
          )}
          <Typography
            noWrap
            sx={{
              flex: 1,
              fontFamily: APPLE_FONT_STACK,
              fontSize: '0.88rem',
              fontWeight: 'inherit',
            }}
          >
            {folder.name}
          </Typography>
          {isSelected && <CheckRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />}
        </Box>
        {hasChildren && isExpanded && children.map(renderNode)}
      </React.Fragment>
    );
  };

  return (
    <BaseDialog
      onClose={() => onClose(false)}
      onSubmit={handleSubmit}
      error={error}
      isLoading={moveMutation.isPending || createFolderMutation.isPending}
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

        <Box
          role="listbox"
          aria-label={intl.formatMessage({
            id: 'folder.move-title',
            defaultMessage: '移动到文件夹',
          })}
          sx={(theme) => {
            const c = appleColors(isDarkTheme(theme));
            return {
              maxHeight: 260,
              overflowY: 'auto',
              p: 0.75,
              borderRadius: '14px',
              border: `1px solid ${c.hairlineStrong}`,
              backgroundColor: c.canvas,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            };
          }}
        >
          <Box
            role="option"
            aria-selected={effectiveSelectedId === null}
            onClick={() => {
              setSelectedFolderId(null);
              setHasUserPicked(true);
              setError(undefined);
            }}
            sx={(theme) => {
              const c = appleColors(isDarkTheme(theme));
              const isSelected = effectiveSelectedId === null;
              return {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                px: '10px',
                py: '8px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontFamily: APPLE_FONT_STACK,
                fontSize: '0.88rem',
                fontWeight: isSelected ? 700 : 600,
                color: isSelected ? c.amberText : c.textPrimary,
                backgroundColor: isSelected ? c.amberSoft : 'transparent',
                ...applePressMixin,
                '&:hover': {
                  backgroundColor: isSelected ? c.amberSoftHover : c.hoverFill,
                },
              };
            }}
          >
            <HomeRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
            <Typography
              noWrap
              sx={{ flex: 1, fontFamily: APPLE_FONT_STACK, fontSize: '0.88rem', fontWeight: 'inherit' }}
            >
              <FormattedMessage id="folder.root" defaultMessage="根目录（未分类）" />
            </Typography>
            {effectiveSelectedId === null && <CheckRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />}
          </Box>

          {folderTree.map(renderNode)}
        </Box>

        {creatingInline ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              autoFocus
              placeholder={
                effectiveSelectedId === null ? '在根目录新建文件夹名称' : '在当前选中文件夹下新建子文件夹'
              }
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateInlineFolder();
                }
              }}
              slotProps={{ htmlInput: { maxLength: FOLDER_NAME_MAX_LENGTH } }}
            />
            <Button
              type="button"
              variant="contained"
              size="small"
              disableElevation
              disabled={createFolderMutation.isPending}
              onClick={handleCreateInlineFolder}
              sx={{ flexShrink: 0, borderRadius: '10px', fontWeight: 700 }}
            >
              创建
            </Button>
            <Button
              type="button"
              size="small"
              onClick={() => {
                setCreatingInline(false);
                setNewFolderName('');
              }}
              sx={{ flexShrink: 0, borderRadius: '10px' }}
            >
              取消
            </Button>
          </Box>
        ) : (
          <Box>
            <Button
              type="button"
              size="small"
              startIcon={<CreateNewFolderRoundedIcon />}
              onClick={() => setCreatingInline(true)}
              sx={{ borderRadius: '10px', fontWeight: 600, fontFamily: APPLE_FONT_STACK }}
            >
              {effectiveSelectedId === null ? '新建文件夹' : '在选中目录下新建子文件夹'}
            </Button>
          </Box>
        )}
      </Box>
    </BaseDialog>
  );
};

export default MoveFolderDialog;
