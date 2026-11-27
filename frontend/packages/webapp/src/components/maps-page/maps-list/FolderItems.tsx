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

import React, { memo, useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Folder } from '../../../classes/client';
import { useDate } from '../../../classes/app-i18n/dates';
import { GoogleIcon } from '../../common/google-symbol';
import { MAP_IDS_DRAG_MIME, getFolderBreadcrumbs } from '../folderTree';
import {
  APPLE_FONT_STACK,
  RADIUS_LG,
  RADIUS_MD,
  appleColors,
  isDarkTheme,
} from '../appleDesign';
import type { FolderDirectCount } from './model';
import {
  ActionIconButton,
  BodyCell,
  BreadcrumbBar,
  BreadcrumbChip,
  CardTitle,
  CellText,
  CompactCardHeader,
  FolderGlyphBadge,
  GridCardActionsOverlay,
  GridCardBody,
  GridCardMeta,
  GridCardPreview,
  GridCardRoot,
  GridCardTitle,
  LabelsBodyCell,
  MapCardRoot,
  MapRowTitleWrap,
} from './styled';

export type FolderMenuState = {
  folder: Folder;
  anchor?: HTMLElement | undefined;
  anchorPosition?: { top: number; left: number } | undefined;
};

export interface FolderItemHandlers {
  onOpenFolder: (folderId: number) => void;
  onOpenMenu: (folder: Folder, anchor: HTMLElement) => void;
  onContextMenu: (folder: Folder, event: React.MouseEvent<HTMLElement>) => void;
  onDropMaps?: ((mapIds: number[], folderId: number | null) => void) | undefined;
}

const formatFolderSummary = (count?: FolderDirectCount): string => {
  if (!count || count.totalCount === 0) {
    return '空文件夹';
  }
  const parts: string[] = [];
  if (count.subfolderCount > 0) {
    parts.push(`${count.subfolderCount} 个文件夹`);
  }
  if (count.mapCount > 0) {
    parts.push(`${count.mapCount} 份导图`);
  }
  return parts.join(' · ');
};

export interface FolderDropTargetResult {
  isDragTarget: boolean;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
}

/**
 * Shared HTML5 drag-and-drop hook allowing maps to be dropped onto any folder row,
 * folder grid card, or breadcrumb ancestor node.
 */
export function useFolderDropTarget(
  targetFolderId: number | null,
  onDropMaps?: (mapIds: number[], folderId: number | null) => void,
): FolderDropTargetResult {
  const [isDragTarget, setIsDragTarget] = useState(false);

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      if (!onDropMaps || !e.dataTransfer.types.includes(MAP_IDS_DRAG_MIME)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsDragTarget(true);
    },
    [onDropMaps],
  );

  const onDragLeave = useCallback(() => {
    setIsDragTarget(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      setIsDragTarget(false);
      if (!onDropMaps || !e.dataTransfer.types.includes(MAP_IDS_DRAG_MIME)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      try {
        const raw = e.dataTransfer.getData(MAP_IDS_DRAG_MIME);
        const ids = JSON.parse(raw);
        if (Array.isArray(ids) && ids.length > 0) {
          const validIds = ids.filter((id): id is number => typeof id === 'number');
          if (validIds.length > 0) {
            onDropMaps(validIds, targetFolderId);
          }
        }
      } catch {
        // ignore malformed drag payload
      }
    },
    [onDropMaps, targetFolderId],
  );

  return { isDragTarget, onDragOver, onDragLeave, onDrop };
}

interface FolderItemProps extends FolderItemHandlers {
  folder: Folder;
  count?: FolderDirectCount | undefined;
}

const FolderRowComponent = ({
  folder,
  count,
  onOpenFolder,
  onOpenMenu,
  onContextMenu,
  onDropMaps,
}: FolderItemProps): React.ReactElement => {
  const date = useDate();
  const { isDragTarget, onDragOver, onDragLeave, onDrop } = useFolderDropTarget(
    folder.id,
    onDropMaps,
  );
  const displayTime = folder.updatedTime ?? folder.creationTime;

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenMenu(folder, event.currentTarget);
  };

  return (
    <TableRow
      hover
      onClick={() => onOpenFolder(folder.id)}
      onContextMenu={(e) => onContextMenu(folder, e)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid={`folder-row-${folder.id}`}
      sx={(theme) => {
        const c = appleColors(isDarkTheme(theme));
        return {
          cursor: 'pointer',
          ...(isDragTarget
            ? {
                backgroundColor: `${c.amberSoft} !important`,
                outline: `2px dashed ${c.amber}`,
                outlineOffset: '-2px',
              }
            : {}),
        };
      }}
    >
      <BodyCell padding="checkbox" />
      <BodyCell>
        <MapRowTitleWrap>
          <FolderGlyphBadge aria-hidden="true">
            <GoogleIcon name="folder" size={18} filled />
          </FolderGlyphBadge>
          <Box
            component="button"
            type="button"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onOpenFolder(folder.id);
            }}
            sx={(theme) => {
              const c = appleColors(isDarkTheme(theme));
              return {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: APPLE_FONT_STACK,
                fontSize: '0.9rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: c.textPrimary,
                transition: 'color 120ms ease',
                '&:hover': {
                  color: c.amberText,
                },
              };
            }}
          >
            {folder.name}
          </Box>
        </MapRowTitleWrap>
      </BodyCell>
      <LabelsBodyCell />
      <BodyCell>
        <CellText variant="body2" sx={{ whiteSpace: 'nowrap' }}>
          {count?.totalCount ?? 0} 项
        </CellText>
      </BodyCell>
      <BodyCell>
        {displayTime ? (
          <Tooltip arrow={true} title={date(displayTime).format('lll')} placement="bottom-start">
            <CellText variant="body2">{date(displayTime).fromNow()}</CellText>
          </Tooltip>
        ) : (
          <CellText variant="body2">—</CellText>
        )}
      </BodyCell>
      <BodyCell padding="checkbox" />
      <BodyCell>
        <Tooltip arrow={true} title="文件夹操作">
          <ActionIconButton>
            <IconButton
              aria-label={`操作文件夹 ${folder.name}`}
              size="small"
              onClick={handleOpenMenu}
            >
              <GoogleIcon name="more_horiz" size={19} />
            </IconButton>
          </ActionIconButton>
        </Tooltip>
      </BodyCell>
    </TableRow>
  );
};

export const FolderRow = memo(FolderRowComponent);

const FolderGridCardComponent = ({
  folder,
  count,
  onOpenFolder,
  onOpenMenu,
  onContextMenu,
  onDropMaps,
}: FolderItemProps): React.ReactElement => {
  const date = useDate();
  const { isDragTarget, onDragOver, onDragLeave, onDrop } = useFolderDropTarget(
    folder.id,
    onDropMaps,
  );
  const displayTime = folder.updatedTime ?? folder.creationTime;

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenMenu(folder, event.currentTarget);
  };

  return (
    <GridCardRoot
      selected={isDragTarget}
      onClick={() => onOpenFolder(folder.id)}
      onContextMenu={(e) => onContextMenu(folder, e)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid={`folder-grid-card-${folder.id}`}
      sx={(theme) => {
        const c = appleColors(isDarkTheme(theme));
        return isDragTarget
          ? {
              backgroundColor: c.amberSoft,
              outline: `2px dashed ${c.amber}`,
              outlineOffset: '-2px',
            }
          : {};
      }}
    >
      <GridCardPreview
        sx={(theme) => {
          const c = appleColors(isDarkTheme(theme));
          return {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: isDarkTheme(theme) ? '#2C2C2E' : '#F2F2F7',
            borderBottom: `1px solid ${c.hairline}`,
          };
        }}
      >
        <GoogleIcon
          name="folder"
          size={40}
          filled
          style={{ color: '#007AFF' }}
        />
        <GridCardActionsOverlay className="grid-card-overlay">
          <Tooltip arrow={true} title="文件夹操作">
            <ActionIconButton>
              <IconButton
                size="small"
                aria-label={`操作文件夹 ${folder.name}`}
                onClick={handleOpenMenu}
              >
                <GoogleIcon name="more_horiz" size={18} />
              </IconButton>
            </ActionIconButton>
          </Tooltip>
        </GridCardActionsOverlay>
      </GridCardPreview>

      <GridCardBody>
        <Tooltip title={folder.name} enterDelay={500} placement="top-start">
          <GridCardTitle>{folder.name}</GridCardTitle>
        </Tooltip>
        <GridCardMeta>
          <span>{formatFolderSummary(count)}</span>
          {displayTime && <span>{date(displayTime).fromNow()}</span>}
        </GridCardMeta>
      </GridCardBody>
    </GridCardRoot>
  );
};

export const FolderGridCard = memo(FolderGridCardComponent);

const FolderCardComponent = ({
  folder,
  count,
  onOpenFolder,
  onOpenMenu,
  onContextMenu,
  onDropMaps,
}: FolderItemProps): React.ReactElement => {
  const { isDragTarget, onDragOver, onDragLeave, onDrop } = useFolderDropTarget(
    folder.id,
    onDropMaps,
  );

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenMenu(folder, event.currentTarget);
  };

  return (
    <MapCardRoot
      elevation={0}
      onClick={() => onOpenFolder(folder.id)}
      onContextMenu={(e) => onContextMenu(folder, e)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid={`folder-card-${folder.id}`}
      sx={(theme) => {
        const c = appleColors(isDarkTheme(theme));
        return {
          cursor: 'pointer',
          ...(isDragTarget
            ? {
                boxShadow: `0 0 0 2px ${c.amberRing}`,
                backgroundColor: c.amberSoft,
              }
            : {}),
        };
      }}
    >
      <CompactCardHeader
        avatar={
          <FolderGlyphBadge aria-hidden="true">
            <GoogleIcon name="folder" size={18} filled />
          </FolderGlyphBadge>
        }
        action={
          <Tooltip arrow={true} title="文件夹操作">
            <ActionIconButton>
              <IconButton
                aria-label={`操作文件夹 ${folder.name}`}
                onClick={handleOpenMenu}
              >
                <GoogleIcon name="more_vert" size={20} />
              </IconButton>
            </ActionIconButton>
          </Tooltip>
        }
        title={<CardTitle noWrap>{folder.name}</CardTitle>}
        subheader={
          <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', fontWeight: 400 }}>
            {formatFolderSummary(count)}
          </Typography>
        }
      />
    </MapCardRoot>
  );
};

export const FolderCard = memo(FolderCardComponent);

interface BreadcrumbDropItemProps {
  folderId: number | null;
  label: string;
  icon?: React.ReactNode;
  onNavigate: (folderId: number | null) => void;
  onDropMaps?: ((mapIds: number[], folderId: number | null) => void) | undefined;
}

const BreadcrumbDropItem = ({
  folderId,
  label,
  icon,
  onNavigate,
  onDropMaps,
}: BreadcrumbDropItemProps): React.ReactElement => {
  const { isDragTarget, onDragOver, onDragLeave, onDrop } = useFolderDropTarget(
    folderId,
    onDropMaps,
  );
  return (
    <BreadcrumbChip
      type="button"
      dragTarget={isDragTarget}
      onClick={() => onNavigate(folderId)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {icon}
      <span>{label}</span>
    </BreadcrumbChip>
  );
};

interface FolderBreadcrumbsBarProps {
  folders: Folder[];
  currentFolderId: number;
  onNavigate: (folderId: number | null) => void;
  onDropMaps?: ((mapIds: number[], folderId: number | null) => void) | undefined;
}

/** Compact path navigation shown inside subdirectories, supporting clicks and map drops. */
export const FolderBreadcrumbsBar = ({
  folders,
  currentFolderId,
  onNavigate,
  onDropMaps,
}: FolderBreadcrumbsBarProps): React.ReactElement => {
  const chain = getFolderBreadcrumbs(folders, currentFolderId);
  const parentFolderId = chain.length > 1 ? chain[chain.length - 2]!.id : null;

  return (
    <BreadcrumbBar aria-label="文件夹路径">
      <BreadcrumbChip
        type="button"
        onClick={() => onNavigate(parentFolderId)}
        aria-label="返回上级"
      >
        <GoogleIcon name="arrow_back" size={15} />
        <span>返回上级</span>
      </BreadcrumbChip>

      <Box
        aria-hidden="true"
        sx={{ width: '1px', height: '14px', backgroundColor: 'divider', mx: '2px' }}
      />

      <BreadcrumbDropItem
        folderId={null}
        label="根目录"
        icon={<GoogleIcon name="home" size={15} />}
        onNavigate={onNavigate}
        onDropMaps={onDropMaps}
      />

      {chain.map((crumb, index) => {
        const isLast = index === chain.length - 1;
        return (
          <React.Fragment key={crumb.id}>
            <GoogleIcon name="chevron_right" size={15} style={{ opacity: 0.55 }} />
            {isLast ? (
              <BreadcrumbChip type="button" active disabled>
                <GoogleIcon name="folder" size={15} filled style={{ opacity: 0.85 }} />
                <span>{crumb.name}</span>
              </BreadcrumbChip>
            ) : (
              <BreadcrumbDropItem
                folderId={crumb.id}
                label={crumb.name}
                onNavigate={onNavigate}
                onDropMaps={onDropMaps}
              />
            )}
          </React.Fragment>
        );
      })}
    </BreadcrumbBar>
  );
};

interface FolderActionMenuProps {
  menuState: FolderMenuState | null;
  onClose: () => void;
  onCreateFolder?: ((parentId: number | null) => void) | undefined;
  onRenameFolder?: ((folder: Folder) => void) | undefined;
  onMoveFolder?: ((folder: Folder) => void) | undefined;
  onDeleteFolder?: ((folder: Folder) => void) | undefined;
}

export const FolderActionMenu = ({
  menuState,
  onClose,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
}: FolderActionMenuProps): React.ReactElement => {
  const intl = useIntl();

  return (
    <Menu
      anchorEl={menuState?.anchor ?? null}
      anchorReference={menuState?.anchorPosition ? 'anchorPosition' : 'anchorEl'}
      anchorPosition={menuState?.anchorPosition}
      open={Boolean(menuState)}
      onClose={onClose}
      elevation={0}
      slotProps={{
        paper: {
          sx: (theme) => {
            const c = appleColors(isDarkTheme(theme));
            return {
              borderRadius: RADIUS_LG,
              border: 'none',
              boxShadow: c.shadowFloat,
              fontFamily: APPLE_FONT_STACK,
              backgroundColor: isDarkTheme(theme) ? '#1C1C1E' : '#FFFFFF',
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
            };
          },
        },
      }}
    >
      {onCreateFolder && (
        <MenuItem
          onClick={() => {
            const folder = menuState?.folder;
            onClose();
            if (folder) {
              onCreateFolder(folder.id);
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <GoogleIcon name="create_new_folder" size={18} />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({
              id: 'folder.new-subfolder',
              defaultMessage: '新建子文件夹',
            })}
          />
        </MenuItem>
      )}
      {onRenameFolder && (
        <MenuItem
          onClick={() => {
            const folder = menuState?.folder;
            onClose();
            if (folder) {
              onRenameFolder(folder);
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <GoogleIcon name="edit" size={18} />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({
              id: 'folder.rename',
              defaultMessage: '重命名文件夹',
            })}
          />
        </MenuItem>
      )}
      {onMoveFolder && (
        <MenuItem
          onClick={() => {
            const folder = menuState?.folder;
            onClose();
            if (folder) {
              onMoveFolder(folder);
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <GoogleIcon name="drive_file_move" size={18} />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({
              id: 'folder.move',
              defaultMessage: '移动到...',
            })}
          />
        </MenuItem>
      )}
      {onDeleteFolder && (
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            const folder = menuState?.folder;
            onClose();
            if (folder) {
              onDeleteFolder(folder);
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
            <GoogleIcon name="delete" size={18} />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({
              id: 'folder.delete',
              defaultMessage: '删除文件夹',
            })}
          />
        </MenuItem>
      )}
    </Menu>
  );
};
