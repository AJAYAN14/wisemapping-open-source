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

import React, { use, useEffect, useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import { ErrorInfo, FOLDER_NAME_MAX_LENGTH, Folder } from '../../../classes/client';
import { ClientContext } from '../../../classes/provider/client-context';
import { FolderTreeNode, buildFolderTree } from '../folderTree';
import { APPLE_FONT_STACK, appleColors, applePressMixin, isDarkTheme } from '../appleDesign';

export interface FolderTreePickerProps {
  folders: Folder[];
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
  disabledIds?: ReadonlySet<number> | undefined;
  initialExpandedIds?: ReadonlySet<number> | undefined;
  allowInlineCreate?: boolean | undefined;
  ariaLabel?: string | undefined;
  onError?: ((error: ErrorInfo | undefined) => void) | undefined;
  onLoadingChange?: ((loading: boolean) => void) | undefined;
  onFolderCreated?: ((folder: Folder) => void) | undefined;
}

/**
 * Shared hierarchical folder picker used by both map-move and folder-move dialogs,
 * supporting disabled subtrees (cycle prevention) and optional inline folder creation.
 */
export const FolderTreePicker = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  disabledIds,
  initialExpandedIds,
  allowInlineCreate = false,
  ariaLabel = '选择目标文件夹',
  onError,
  onLoadingChange,
  onFolderCreated,
}: FolderTreePickerProps): React.ReactElement => {
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    () => new Set(initialExpandedIds ?? []),
  );
  const [creatingInline, setCreatingInline] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const tree = useMemo(() => buildFolderTree(folders), [folders]);

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
      onFolderCreated?.(created);
      onSelectFolder(created.id);
      setNewFolderName('');
      setCreatingInline(false);
      onError?.(undefined);
    },
    onError: (err) => onError?.(err),
  });

  useEffect(() => {
    onLoadingChange?.(createFolderMutation.isPending);
  }, [createFolderMutation.isPending, onLoadingChange]);

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

  const handleCreateInlineFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      onError?.({ msg: '文件夹名称不能为空。' });
      return;
    }
    if (/[\\/]/.test(trimmed)) {
      onError?.({ msg: '文件夹名称不能包含斜杠（/ 或 \\）。' });
      return;
    }
    const targetParentId =
      selectedFolderId !== null && disabledIds?.has(selectedFolderId) ? null : selectedFolderId;
    onError?.(undefined);
    createFolderMutation.mutate({ name: trimmed, parentId: targetParentId });
  };

  const renderNode = (node: FolderTreeNode): React.ReactNode => {
    const { folder, children, depth } = node;
    const isDisabled = Boolean(disabledIds?.has(folder.id));
    const isSelected = selectedFolderId === folder.id;
    const isExpanded = expandedIds.has(folder.id);
    const hasChildren = children.length > 0;

    return (
      <React.Fragment key={folder.id}>
        <Box
          role="option"
          aria-selected={isSelected}
          aria-disabled={isDisabled || undefined}
          onClick={() => {
            if (!isDisabled) {
              onSelectFolder(folder.id);
              onError?.(undefined);
            }
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
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.45 : 1,
              fontFamily: APPLE_FONT_STACK,
              fontSize: '0.88rem',
              fontWeight: isSelected ? 700 : 600,
              color: isSelected ? c.amberText : c.textPrimary,
              backgroundColor: isSelected ? c.amberSoft : 'transparent',
              ...(isDisabled ? {} : applePressMixin),
              '&:hover': isDisabled
                ? {}
                : {
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
            <FolderOpenRoundedIcon
              sx={{ fontSize: 18, color: isSelected ? 'inherit' : '#F59E0B', flexShrink: 0 }}
            />
          ) : (
            <FolderRoundedIcon
              sx={{ fontSize: 18, color: '#F59E0B', opacity: 0.85, flexShrink: 0 }}
            />
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        role="listbox"
        aria-label={ariaLabel}
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
          aria-selected={selectedFolderId === null}
          onClick={() => {
            onSelectFolder(null);
            onError?.(undefined);
          }}
          sx={(theme) => {
            const c = appleColors(isDarkTheme(theme));
            const isSelected = selectedFolderId === null;
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
          {selectedFolderId === null && <CheckRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />}
        </Box>

        {tree.map(renderNode)}
      </Box>

      {allowInlineCreate &&
        (creatingInline ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              autoFocus
              placeholder={
                selectedFolderId === null ? '在根目录新建文件夹名称' : '在当前选中文件夹下新建子文件夹'
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
              {selectedFolderId === null ? '新建文件夹' : '在选中目录下新建子文件夹'}
            </Button>
          </Box>
        ))}
    </Box>
  );
};
