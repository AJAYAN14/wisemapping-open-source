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
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DriveFileMoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';

import logoIcon from '../../../../images/logo-icon.svg';
import { DesktopDrawerToggle } from '../styled';
import StyleListItem from './filter-list-item';
import {
  DrawerContent,
  FolderItemRoot,
  FolderMoreButton,
  FilterListItemButton,
  LogoIcon,
  LogoText,
  LogoBox,
  SectionActionButton,
  SectionHeader,
  UserAvatarBadge,
  UserAvatarImage,
  UserEmail,
  UserInfoBox,
  UserName,
} from './styled';
import type { AccountInfo, Folder } from '../../../classes/client';
import type { Filter, FolderFilter, GenericFilter, LabelFilter } from '../index';
import {
  FolderTreeNode,
  MAP_IDS_DRAG_MIME,
  buildFolderTree,
  getFolderBreadcrumbs,
} from '../folderTree';
import { APPLE_FONT_STACK, appleColors, isDarkTheme } from '../appleDesign';
import { useIntl } from 'react-intl';

export interface ToolbarButtonInfo {
  filter: GenericFilter | LabelFilter;
  label: string;
  icon: React.ReactElement;
  count?: number | undefined;
  acceptDropToRoot?: boolean | undefined;
}

export interface DrawerNavProps {
  /** Account of the logged-in user, when already fetched. */
  account: AccountInfo | undefined;
  /** True when either the desktop or the mobile drawer is expanded. */
  drawerOpen: boolean;
  /** Filter entries to render, in order. */
  filterButtons: ToolbarButtonInfo[];
  /** Folders owned by the user. */
  folders?: Folder[];
  /** Direct map count per folder ID. */
  folderCounts?: Map<number, number> | undefined;
  /** Currently applied filter. */
  activeFilter: Filter;
  onFilterClick: (filter: Filter) => void;
  onLabelDelete: (id: number) => void;
  onCreateFolder?: (parentId: number | null) => void;
  onRenameFolder?: (folder: Folder) => void;
  onMoveFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  onDropMapsToFolder?: (mapIds: number[], folderId: number | null) => void;
  onToggleDesktopDrawer?: (() => void) | undefined;
}

/**
 * Contents shared by the maps page mobile and desktop drawers: product logo,
 * grouped filter navigation list, hierarchical folder tree, and the signed-in user's details.
 */
const DrawerNav = ({
  account,
  drawerOpen,
  filterButtons,
  folders = [],
  folderCounts,
  activeFilter,
  onFilterClick,
  onLabelDelete,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onDropMapsToFolder,
  onToggleDesktopDrawer,
}: DrawerNavProps): ReactElement => {
  const intl = useIntl();

  const primaryButtons = filterButtons.filter((b) => b.filter.type !== 'label');
  const labelButtons = filterButtons.filter((b) => b.filter.type === 'label');
  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(() => new Set());
  const [dragTargetFolderId, setDragTargetFolderId] = useState<number | null>(null);
  const [folderMenuState, setFolderMenuState] = useState<{
    anchor: HTMLElement;
    folder: Folder;
  } | null>(null);

  useEffect(() => {
    if (activeFilter.type === 'folder') {
      const chain = getFolderBreadcrumbs(folders, (activeFilter as FolderFilter).folderId);
      if (chain.length > 1) {
        setExpandedFolderIds((prev) => {
          const next = new Set(prev);
          for (let i = 0; i < chain.length - 1; i += 1) {
            next.add(chain[i]!.id);
          }
          return next;
        });
      }
    }
  }, [activeFilter, folders]);

  const toggleFolderExpand = (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderFolderNode = (node: FolderTreeNode): React.ReactNode => {
    const { folder, children, depth } = node;
    const isSelected =
      activeFilter.type === 'folder' && (activeFilter as FolderFilter).folderId === folder.id;
    const isExpanded = expandedFolderIds.has(folder.id);
    const hasChildren = children.length > 0;
    const isDragTarget = dragTargetFolderId === folder.id;
    const count = folderCounts?.get(folder.id);

    if (!drawerOpen && depth > 0) {
      return null;
    }

    return (
      <React.Fragment key={folder.id}>
        <FolderItemRoot>
          <FilterListItemButton
            selected={isSelected}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
              e.stopPropagation();
              onFilterClick({ type: 'folder', folderId: folder.id });
            }}
            onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
              if (!onDropMapsToFolder || !e.dataTransfer.types.includes(MAP_IDS_DRAG_MIME)) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              if (dragTargetFolderId !== folder.id) {
                setDragTargetFolderId(folder.id);
              }
              if (hasChildren && !isExpanded) {
                setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
              }
            }}
            onDragLeave={() => {
              if (dragTargetFolderId === folder.id) {
                setDragTargetFolderId(null);
              }
            }}
            onDrop={(e: React.DragEvent<HTMLDivElement>) => {
              setDragTargetFolderId(null);
              if (!onDropMapsToFolder || !e.dataTransfer.types.includes(MAP_IDS_DRAG_MIME)) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              try {
                const raw = e.dataTransfer.getData(MAP_IDS_DRAG_MIME);
                const ids = JSON.parse(raw);
                if (Array.isArray(ids) && ids.length > 0) {
                  onDropMapsToFolder(
                    ids.filter((id): id is number => typeof id === 'number'),
                    folder.id,
                  );
                }
              } catch {
                // ignore malformed drag payload
              }
            }}
            sx={(theme) => {
              const c = appleColors(isDarkTheme(theme));
              return {
                ...(drawerOpen
                  ? {
                      pl: `${10 + depth * 14}px`,
                      pr: '16px',
                      minHeight: '36px',
                    }
                  : {}),
                ...(isDragTarget
                  ? {
                      backgroundColor: c.amberSoft,
                      outline: `2px dashed ${c.amber}`,
                      outlineOffset: '-2px',
                    }
                  : {}),
              };
            }}
          >
            {drawerOpen && (
              hasChildren ? (
                <IconButton
                  size="small"
                  onClick={(e) => toggleFolderExpand(folder.id, e)}
                  sx={{ p: '2px', mr: '2px', color: 'inherit', flexShrink: 0 }}
                  aria-label={isExpanded ? '折叠文件夹' : '展开文件夹'}
                >
                  {isExpanded ? (
                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              ) : (
                <Box sx={{ width: 20, flexShrink: 0 }} />
              )
            )}
            <Tooltip title={folder.name} disableInteractive>
              <ListItemIcon sx={{ minWidth: drawerOpen ? '28px' : undefined }}>
                {isSelected || isExpanded ? (
                  <FolderOpenRoundedIcon fontSize="small" />
                ) : (
                  <FolderRoundedIcon fontSize="small" />
                )}
              </ListItemIcon>
            </Tooltip>
            {drawerOpen && (
              <ListItemText
                primary={folder.name}
                slotProps={{
                  primary: {
                    noWrap: true,
                    sx: {
                      fontSize: '0.88rem',
                      fontWeight: isSelected ? 700 : 600,
                      fontFamily: APPLE_FONT_STACK,
                    },
                  },
                }}
              />
            )}
            {drawerOpen && typeof count === 'number' && count > 0 && (
              <Box
                component="span"
                className="folder-count-badge"
                sx={(theme) => {
                  const c = appleColors(isDarkTheme(theme));
                  return {
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: APPLE_FONT_STACK,
                    color: isSelected ? c.amberText : c.textTertiary,
                    px: '6px',
                    py: '1px',
                    borderRadius: '999px',
                    backgroundColor: isSelected ? 'transparent' : c.hoverFill,
                    transition: 'opacity 140ms ease',
                    '.MuiBox-root:hover > & , .MuiBox-root:hover &': {
                      opacity: 0,
                    },
                  };
                }}
              >
                {count}
              </Box>
            )}
          </FilterListItemButton>
          {drawerOpen && (onCreateFolder || onRenameFolder || onMoveFolder || onDeleteFolder) && (
            <FolderMoreButton
              size="small"
              className="folder-more-button"
              aria-label={`操作文件夹 ${folder.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setFolderMenuState({ anchor: e.currentTarget, folder });
              }}
              sx={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <MoreHorizRoundedIcon sx={{ fontSize: '1rem' }} />
            </FolderMoreButton>
          )}
        </FolderItemRoot>
        {drawerOpen && hasChildren && isExpanded && children.map(renderFolderNode)}
      </React.Fragment>
    );
  };

  const [imgError, setImgError] = React.useState(false);
  const avatarUrl = account?.avatarUrl;

  const displayName =
    account?.fullName?.trim() ||
    [account?.firstname, account?.lastname].filter(Boolean).join(' ') ||
    account?.firstname ||
    account?.email;
  const initial = (displayName || 'W').trim().charAt(0).toUpperCase();

  return (
    <DrawerContent>
      <LogoBox
        key="logo"
        sx={!drawerOpen ? { padding: '14px 6px', justifyContent: 'center', gap: '2px' } : undefined}
      >
        <LogoIcon
          src={logoIcon}
          alt={intl.formatMessage({ id: 'common.logo', defaultMessage: 'WiseMapping logo' })}
          sx={!drawerOpen ? { height: '22px' } : undefined}
        />
        {drawerOpen && (
          <LogoText>
            <span className="logo-wise">wise</span>
            <span className="logo-mapping">mapping</span>
          </LogoText>
        )}
        {onToggleDesktopDrawer && (
          <DesktopDrawerToggle
            aria-label={intl.formatMessage({
              id: 'common.open-drawer',
              defaultMessage: 'Open drawer',
            })}
            onClick={onToggleDesktopDrawer}
            id="open-desktop-drawer"
            sx={
              drawerOpen
                ? { ml: 'auto', mr: 0 }
                : { width: '26px', height: '26px', mr: 0, ml: '2px' }
            }
          >
            {!drawerOpen && <NavigateNextRoundedIcon />}
            {drawerOpen && <NavigateBeforeRoundedIcon />}
          </DesktopDrawerToggle>
        )}
      </LogoBox>

      <List component="nav" sx={{ paddingTop: 0, overflowY: 'auto', flex: 1 }}>
        {drawerOpen && <SectionHeader>分类</SectionHeader>}
        {primaryButtons.map((buttonInfo) => (
          <StyleListItem
            icon={buttonInfo.icon}
            label={buttonInfo.label}
            filter={buttonInfo.filter}
            active={activeFilter}
            count={buttonInfo.count}
            onDropMaps={
              buttonInfo.acceptDropToRoot && onDropMapsToFolder
                ? (ids) => onDropMapsToFolder(ids, null)
                : undefined
            }
            onClick={onFilterClick}
            onDelete={onLabelDelete}
            key={`${buttonInfo.filter.type}:${buttonInfo.label}`}
          />
        ))}

        {drawerOpen && (
          <SectionHeader sx={{ mt: 1 }}>
            <span>
              {intl.formatMessage({ id: 'folder.section-title', defaultMessage: '文件夹' })}
            </span>
            {onCreateFolder && (
              <Tooltip
                title={intl.formatMessage({ id: 'folder.new', defaultMessage: '新建文件夹' })}
              >
                <SectionActionButton
                  size="small"
                  aria-label={intl.formatMessage({
                    id: 'folder.new',
                    defaultMessage: '新建文件夹',
                  })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(null);
                  }}
                >
                  <CreateNewFolderRoundedIcon sx={{ fontSize: '1rem' }} />
                </SectionActionButton>
              </Tooltip>
            )}
          </SectionHeader>
        )}
        {folderTree.length > 0 ? (
          folderTree.map(renderFolderNode)
        ) : (
          drawerOpen && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                px: '18px',
                py: '6px',
                color: 'text.disabled',
                fontFamily: APPLE_FONT_STACK,
                fontSize: '0.78rem',
              }}
            >
              {intl.formatMessage({ id: 'folder.empty', defaultMessage: '暂无文件夹' })}
            </Typography>
          )
        )}

        {labelButtons.length > 0 && drawerOpen && <SectionHeader sx={{ mt: 1 }}>标签</SectionHeader>}
        {labelButtons.map((buttonInfo) => (
          <StyleListItem
            icon={buttonInfo.icon}
            label={buttonInfo.label}
            filter={buttonInfo.filter}
            active={activeFilter}
            onClick={onFilterClick}
            onDelete={onLabelDelete}
            key={`${buttonInfo.filter.type}:${buttonInfo.label}`}
          />
        ))}
      </List>

      <Menu
        anchorEl={folderMenuState?.anchor ?? null}
        open={Boolean(folderMenuState)}
        onClose={() => setFolderMenuState(null)}
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
                  fontSize: '0.86rem',
                  borderRadius: '8px',
                  margin: '2px 6px',
                },
              };
            },
          },
        }}
      >
        {onCreateFolder && (
          <MenuItem
            onClick={() => {
              const folder = folderMenuState?.folder;
              setFolderMenuState(null);
              if (folder) {
                setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
                onCreateFolder(folder.id);
              }
            }}
          >
            <ListItemIcon>
              <CreateNewFolderRoundedIcon fontSize="small" />
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
              const folder = folderMenuState?.folder;
              setFolderMenuState(null);
              if (folder) {
                onRenameFolder(folder);
              }
            }}
          >
            <ListItemIcon>
              <EditRoundedIcon fontSize="small" />
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
              const folder = folderMenuState?.folder;
              setFolderMenuState(null);
              if (folder) {
                onMoveFolder(folder);
              }
            }}
          >
            <ListItemIcon>
              <DriveFileMoveRoundedIcon fontSize="small" />
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
              const folder = folderMenuState?.folder;
              setFolderMenuState(null);
              if (folder) {
                onDeleteFolder(folder);
              }
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <DeleteRoundedIcon fontSize="small" />
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

      {account && drawerOpen && (
        <UserInfoBox>
          {avatarUrl && !imgError ? (
            <UserAvatarImage
              src={avatarUrl}
              alt={displayName || account.email}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <UserAvatarBadge aria-hidden="true">{initial}</UserAvatarBadge>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <UserName variant="body2">{displayName}</UserName>
            <UserEmail variant="caption">{account.email}</UserEmail>
          </Box>
        </UserInfoBox>
      )}
    </DrawerContent>
  );
};

export default DrawerNav;
