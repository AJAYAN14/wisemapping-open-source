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
import { ReactElement, useMemo } from 'react';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LibraryAddRoundedIcon from '@mui/icons-material/LibraryAddRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import { ContextMenuEvent, Designer, ImagePreviewEvent } from '@wisemapping/mindplot';

export type ContextMenuActionId =
  | 'edit'
  | 'previewImage'
  | 'copyTopic'
  | 'copyImage'
  | 'copyText'
  | 'downloadImage'
  | 'pasteAsChild'
  | 'toggleBranch'
  | 'delete'
  | 'paste'
  | 'zoomToFit'
  | 'zoomIn'
  | 'zoomOut';

export type ContextMenuEntry =
  | { kind: 'divider'; key: string }
  | {
      kind: 'item';
      id: ContextMenuActionId;
      label: string;
      shortcut?: string;
      disabled?: boolean;
      destructive?: boolean;
    };

export const buildContextMenuEntries = (event: ContextMenuEvent): ContextMenuEntry[] => {
  if (event.target === 'canvas') {
    const entries: ContextMenuEntry[] = [];
    if (!event.readOnly) {
      entries.push({ kind: 'item', id: 'paste', label: '粘贴', shortcut: 'Ctrl+V' });
      entries.push({ kind: 'divider', key: 'div-canvas' });
    }
    entries.push(
      { kind: 'item', id: 'zoomToFit', label: '适应窗口', shortcut: 'Ctrl+0' },
      { kind: 'item', id: 'zoomIn', label: '放大', shortcut: 'Ctrl++' },
      { kind: 'item', id: 'zoomOut', label: '缩小', shortcut: 'Ctrl+-' },
    );
    return entries;
  }

  const entries: ContextMenuEntry[] = [];
  const hasContent = event.text.trim().length > 0;
  const canCopyTopic = !event.isCentral || event.selectedCount > 1;
  const canDelete = !event.readOnly && (!event.isCentral || event.selectedCount > 1);

  if (!event.readOnly) {
    entries.push({ kind: 'item', id: 'edit', label: '编辑', shortcut: 'F2' });
  }
  if (event.hasImage && event.imageUrl) {
    entries.push({ kind: 'item', id: 'previewImage', label: '查看大图' });
  }
  if (entries.length > 0) {
    entries.push({ kind: 'divider', key: 'div-primary' });
  }

  if (canCopyTopic) {
    entries.push({
      kind: 'item',
      id: 'copyTopic',
      label: '复制主题',
      shortcut: 'Ctrl+C',
    });
  }
  if (event.hasImage && event.imageUrl) {
    entries.push({ kind: 'item', id: 'copyImage', label: '只复制图片' });
  }
  entries.push({
    kind: 'item',
    id: 'copyText',
    label: '只复制内容',
    disabled: !hasContent,
  });
  if (event.hasImage && event.imageUrl) {
    entries.push({ kind: 'item', id: 'downloadImage', label: '下载图片' });
  }

  if (!event.readOnly) {
    entries.push({ kind: 'divider', key: 'div-edit' });
    entries.push({
      kind: 'item',
      id: 'pasteAsChild',
      label: '粘贴为子主题',
      shortcut: 'Ctrl+Shift+V',
    });
    if (event.hasChildren) {
      entries.push({
        kind: 'item',
        id: 'toggleBranch',
        label: event.isCollapsed ? '展开分支' : '折叠分支',
        shortcut: 'Space',
      });
    }
    if (canDelete) {
      entries.push({
        kind: 'item',
        id: 'delete',
        label: '删除',
        shortcut: 'Del',
        destructive: true,
      });
    }
  }

  return entries;
};

const renderMenuIcon = (id: ContextMenuActionId, isCollapsed?: boolean): ReactElement => {
  switch (id) {
    case 'edit':
      return <EditRoundedIcon fontSize="small" />;
    case 'previewImage':
      return <ZoomInRoundedIcon fontSize="small" />;
    case 'copyTopic':
      return <LibraryAddRoundedIcon fontSize="small" />;
    case 'copyImage':
      return <ImageOutlinedIcon fontSize="small" />;
    case 'copyText':
      return <TextFieldsRoundedIcon fontSize="small" />;
    case 'downloadImage':
      return <DownloadRoundedIcon fontSize="small" />;
    case 'pasteAsChild':
    case 'paste':
      return <ContentPasteRoundedIcon fontSize="small" />;
    case 'toggleBranch':
      return isCollapsed ? (
        <UnfoldMoreRoundedIcon fontSize="small" />
      ) : (
        <UnfoldLessRoundedIcon fontSize="small" />
      );
    case 'delete':
      return <DeleteOutlineRoundedIcon fontSize="small" />;
    case 'zoomToFit':
      return <FitScreenRoundedIcon fontSize="small" />;
    case 'zoomIn':
      return <ZoomInRoundedIcon fontSize="small" />;
    case 'zoomOut':
      return <ZoomOutRoundedIcon fontSize="small" />;
    default:
      return <ContentCopyRoundedIcon fontSize="small" />;
  }
};

type MindmapContextMenuProps = {
  contextMenu: ContextMenuEvent | null;
  designer: Designer | undefined;
  onClose: () => void;
  onCopyTopic: () => Promise<void> | void;
  onCopyImage: (imageUrl: string) => Promise<void> | void;
  onCopyText: (text: string) => Promise<void> | void;
  onDownloadImage: (imageUrl: string, title?: string) => Promise<void> | void;
  onPreviewImage: (preview: ImagePreviewEvent) => void;
};

const MindmapContextMenu = ({
  contextMenu,
  designer,
  onClose,
  onCopyTopic,
  onCopyImage,
  onCopyText,
  onDownloadImage,
  onPreviewImage,
}: MindmapContextMenuProps): ReactElement | null => {
  const entries = useMemo(
    () => (contextMenu ? buildContextMenuEntries(contextMenu) : []),
    [contextMenu],
  );

  if (!contextMenu) {
    return null;
  }

  const handleAction = (id: ContextMenuActionId) => {
    const current = contextMenu;
    onClose();

    if (current.target === 'canvas') {
      switch (id) {
        case 'paste':
          void designer?.pasteClipboard();
          break;
        case 'zoomToFit':
          designer?.zoomToFit();
          break;
        case 'zoomIn':
          designer?.zoomIn();
          break;
        case 'zoomOut':
          designer?.zoomOut();
          break;
        default:
          break;
      }
      return;
    }

    switch (id) {
      case 'edit':
        designer?.editTopicById(current.topicId);
        break;
      case 'previewImage':
        if (current.imageUrl) {
          onPreviewImage({
            url: current.imageUrl,
            ...(current.text ? { title: current.text } : {}),
            ...(current.imageWidth ? { width: current.imageWidth } : {}),
            ...(current.imageHeight ? { height: current.imageHeight } : {}),
          });
        }
        break;
      case 'copyTopic':
        void onCopyTopic();
        break;
      case 'copyImage':
        if (current.imageUrl) {
          void onCopyImage(current.imageUrl);
        }
        break;
      case 'copyText':
        void onCopyText(current.text);
        break;
      case 'downloadImage':
        if (current.imageUrl) {
          void onDownloadImage(current.imageUrl, current.text || undefined);
        }
        break;
      case 'pasteAsChild':
        void designer?.pasteClipboardAsChild(current.topicId);
        break;
      case 'toggleBranch':
        designer?.shrinkSelectedBranch();
        break;
      case 'delete':
        designer?.deleteSelectedEntities();
        break;
      default:
        break;
    }
  };

  const isCollapsed = contextMenu.target === 'topic' ? contextMenu.isCollapsed : false;

  return (
    <Menu
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.clientY, left: contextMenu.clientX }}
      onContextMenu={(event) => event.preventDefault()}
      slotProps={{
        paper: {
          elevation: 8,
          sx: (theme) => ({
            minWidth: 210,
            maxWidth: 'calc(100dvw - 24px)',
            borderRadius: '12px',
            py: 0.75,
            backgroundColor: theme.palette.mode === 'dark' ? '#1C1C1E' : '#FFFFFF',
            backgroundImage: 'none',
            border:
              theme.palette.mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.12)'
                : '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 14px 36px rgba(0, 0, 0, 0.56)'
                : '0 12px 32px rgba(15, 23, 42, 0.14)',
          }),
        },
        list: {
          dense: true,
          sx: { py: 0 },
        },
      }}
    >
      {entries.map((entry) => {
        if (entry.kind === 'divider') {
          return <Divider key={entry.key} sx={{ my: 0.5 }} />;
        }

        return (
          <MenuItem
            key={entry.id}
            disabled={entry.disabled}
            onClick={() => handleAction(entry.id)}
            sx={(theme) => ({
              mx: 0.75,
              px: 1.25,
              py: 0.75,
              minHeight: 34,
              borderRadius: '8px',
              gap: 1,
              color: entry.destructive
                ? theme.palette.error.main
                : theme.palette.text.primary,
              '&:hover': {
                backgroundColor: entry.destructive
                  ? theme.palette.mode === 'dark'
                    ? 'rgba(255, 69, 58, 0.14)'
                    : 'rgba(255, 59, 48, 0.08)'
                  : undefined,
              },
            })}
          >
            <ListItemIcon
              sx={{
                minWidth: 24,
                color: entry.destructive ? 'error.main' : 'text.secondary',
              }}
            >
              {renderMenuIcon(entry.id, isCollapsed)}
            </ListItemIcon>
            <ListItemText
              primary={entry.label}
              slotProps={{
                primary: {
                  variant: 'body2',
                  sx: { fontWeight: 500, fontSize: '0.84rem' },
                },
              }}
            />
            {entry.shortcut && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  ml: 2,
                  fontSize: '0.72rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  opacity: 0.72,
                }}
              >
                {entry.shortcut}
              </Typography>
            )}
          </MenuItem>
        );
      })}
    </Menu>
  );
};

export default MindmapContextMenu;
