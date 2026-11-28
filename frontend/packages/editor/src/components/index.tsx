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

import React, { ReactElement, useMemo, useRef, useState } from 'react';

import { IntlProvider, FormattedMessage } from 'react-intl';
import { $notify, ContextMenuEvent, DeleteConfirmEvent, ImagePreviewEvent } from '@wisemapping/mindplot';
import {
  blobToDataUrl,
  compressTopicImage,
  replaceFilenameExtension,
} from '../utils/imageAssetUtils';
import {
  copyImageToClipboard,
  copyTextToClipboard,
  downloadTopicImage,
} from '../utils/topicImageClipboard';
import MindmapContextMenu from './mindmap-context-menu';
import TopicImageLightbox from './topic-image-lightbox';
import ConfirmDeleteDialog from './confirm-delete-dialog';

import { useLocaleData } from '../classes/i18n-msg';

import { ThemeProvider, StyledEngineProvider, styled } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from './app-bar';
import { ToolbarActionType } from './toolbar/ToolbarActionType';
import EditorToolbar from './editor-toolbar';
import VisualizationToolbar from './visualization-toolbar';
import { EditorConfiguration } from '../hooks/useEditor';
import { WidgetPopover } from './widgetPopover';
import DefaultWidgetBuilder from '../classes/default-widget-manager';
import { EditorThemeProvider, useTheme } from '../contexts/ThemeContext';
import { createEditorTheme } from '../theme';
import { ThemeVariantStorage } from '../types/ThemeVariantStorage';
import EditorLoadingSkeleton from './editor-loading-skeleton';
import { useCanvasViewportInsets } from '../hooks/useCanvasViewportInsets';

const EMBED_READY_ATTRIBUTE = 'data-wisemapping-embed-loaded';

const Notifier = styled('div')`
  border: 1px solid
    ${({ theme }) => (theme.palette.mode === 'dark' ? '#757575' : 'rgb(241, 163, 39)')};
  background-color: ${({ theme }) =>
    theme.palette.mode === 'dark' ? '#424242' : 'rgb(252, 235, 192)'};
  border-radius: 3px;
  position: fixed;
  padding: 5px 9px;
  color: ${({ theme }) => (theme.palette.mode === 'dark' ? '#E0E0E0' : 'black')};
  max-width: calc(100dvw - 32px);
  white-space: normal;
  text-align: center;
  margin-top: 5px;
  display: none;
  bottom: max(10px, env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  font-family: 'Montserrat', Arial, Helvetica, sans-serif;
`;

type EditorProps = {
  onAction: (action: ToolbarActionType) => void;
  onExportTopic?: ((topicId: number) => void) | undefined;
  config: EditorConfiguration;
  accountConfiguration?: React.ReactElement;
  themeVariantStorage: ThemeVariantStorage; // Theme variant storage for persistence (mandatory)
};

const EditorContent = ({
  config,
  onAction,
  onExportTopic,
  accountConfiguration,
  themeVariantStorage,
}: EditorProps): ReactElement => {
  // We can access editor instance and other configuration from editor props
  const { model, mindplotRef, mapInfo, capability, options } = config;
  const designer = model?.getDesigner();
  const { mode: internalMode } = useTheme();
  const [imagePreview, setImagePreview] = useState<ImagePreviewEvent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteConfirmEvent | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuEvent | null>(null);

  // Subscribe to designer image preview, delete confirmation, and custom context menu requests
  React.useEffect(() => {
    if (!designer) {
      return undefined;
    }
    const handleImagePreview = (payload: ImagePreviewEvent) => {
      setImagePreview(payload);
    };
    const handleDeleteConfirm = (payload: DeleteConfirmEvent) => {
      setPendingDelete(payload);
    };
    const handleContextMenu = (payload: ContextMenuEvent) => {
      setContextMenu(payload);
    };
    designer.addEvent('imagePreview', handleImagePreview);
    designer.addEvent('deleteConfirm', handleDeleteConfirm);
    designer.addEvent('contextMenu', handleContextMenu);
    return () => {
      designer.removeEvent('imagePreview', handleImagePreview);
      designer.removeEvent('deleteConfirm', handleDeleteConfirm);
      designer.removeEvent('contextMenu', handleContextMenu);
    };
  }, [designer]);

  // Zoom to fit keeps the map clear of the app bar and the floating toolbars.
  useCanvasViewportInsets(designer);

  // Get the current theme mode from the theme context
  const mode = internalMode;

  // Memoize default widget builder to avoid recreating on every render
  const defaultWidgetBuilderRef = useRef<DefaultWidgetBuilder | undefined>(undefined);
  if (!defaultWidgetBuilderRef.current) {
    defaultWidgetBuilderRef.current = new DefaultWidgetBuilder();
  }

  // Memoize widget builder to avoid recreating on every render
  const widgetBulder = useMemo(
    () => designer?.getWidgetManager() ?? defaultWidgetBuilderRef.current!,
    [designer],
  );

  // Memoize theme creation - this is expensive and should only run when mode changes
  const theme = useMemo(() => createEditorTheme(mode), [mode]);

  // Set initial theme variant from query parameter if provided
  React.useEffect(() => {
    if (options.initialThemeVariant) {
      themeVariantStorage.setThemeVariant(options.initialThemeVariant);
    }
  }, [options.initialThemeVariant, themeVariantStorage]);

  // Initialize and sync mindmap theme variant with editor theme
  // Only run once when designer becomes available, then update when mode changes
  React.useEffect(() => {
    if (designer) {
      designer.initializeThemeVariant(mode);
      designer.setThemeVariant(mode === 'dark' ? 'dark' : 'light');
    }
  }, [designer, mode]);

  // Listen for theme variant changes from storage and update designer directly
  // This ensures immediate updates when ThemeVariantStorage changes, bypassing the mode state
  React.useEffect(() => {
    if (!designer) return;

    const unsubscribe = themeVariantStorage.subscribe((variant) => {
      // Update the designer directly when storage changes
      // This is more direct than waiting for the mode state to update
      designer.setThemeVariant(variant);
    });

    return unsubscribe;
  }, [themeVariantStorage, designer]);

  // Memoize embed route check to avoid checking window.location on every render
  const isEmbedRoute = useMemo(
    () => typeof window !== 'undefined' && window.location.pathname.includes('/embed'),
    [],
  );

  // Mark embed DOM element when the map has finished loading
  React.useEffect(() => {
    if (!designer || !isEmbedRoute) {
      return undefined;
    }

    const handleLoadSuccess = () => {
      if (typeof document !== 'undefined') {
        document.body.setAttribute(EMBED_READY_ATTRIBUTE, 'true');
      }
    };

    designer.addEvent('loadSuccess', handleLoadSuccess);

    if (model?.isMapLoadded()) {
      handleLoadSuccess();
    }

    return () => {
      designer.removeEvent('loadSuccess', handleLoadSuccess);
      if (typeof document !== 'undefined') {
        document.body.removeAttribute(EMBED_READY_ATTRIBUTE);
      }
    };
  }, [designer, model, isEmbedRoute]);

  // Support pasting an image directly onto a selected topic on the canvas
  const { uploadTopicImage } = options;
  React.useEffect(() => {
    if (!designer || capability.isHidden('edition-toolbar') || typeof document === 'undefined') {
      return undefined;
    }

    const onDocumentPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('.MuiDialog-root, .MuiPopover-root'))
      ) {
        return;
      }

      const selectedTopic = designer.getModel().selectedTopic();
      if (!selectedTopic) {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          imageFile = item.getAsFile();
          if (imageFile) {
            break;
          }
        }
      }

      if (!imageFile) {
        return;
      }

      event.preventDefault();
      void (async () => {
        try {
          $notify('正在处理并上传图片...');
          const compressed = await compressTopicImage(imageFile);
          const targetFilename =
            compressed.mimeType === 'image/avif'
              ? replaceFilenameExtension(imageFile.name, 'avif', 'pasted-image')
              : imageFile.name || 'pasted-image.png';
          const nextImage = uploadTopicImage
            ? await uploadTopicImage(compressed.blob, targetFilename, {
                width: compressed.width,
                height: compressed.height,
              })
            : {
                url: await blobToDataUrl(compressed.blob),
                width: compressed.width,
                height: compressed.height,
              };
          designer.changeTopicImage(nextImage);
          $notify('已将图片添加到所选节点');
        } catch (err) {
          $notify(err instanceof Error ? err.message : '粘贴图片上传失败');
        }
      })();
    };

    document.addEventListener('paste', onDocumentPaste);
    return () => document.removeEventListener('paste', onDocumentPaste);
  }, [designer, capability, uploadTopicImage]);

  // Initialize locale ...
  const locale = options.locale;
  const intlLocale = useLocaleData(locale);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <IntlProvider locale={intlLocale.locale} messages={intlLocale.messages}>
          {options.enableAppBar && (
            <AppBar
              model={model}
              mapInfo={mapInfo}
              capability={capability}
              onAction={onAction}
              accountConfig={accountConfiguration}
              uploadTopicImage={options.uploadTopicImage}
            />
          )}

          <WidgetPopover widgetManager={widgetBulder} designer={designer} />

          {model && (
            <div className="no-print">
              <EditorToolbar
                model={model}
                capability={capability}
                uploadTopicImage={options.uploadTopicImage}
                hasAppBar={Boolean(options.enableAppBar)}
              />
              <VisualizationToolbar
                model={model}
                capability={capability}
                hasAppBar={Boolean(options.enableAppBar)}
              />
            </div>
          )}

          {React.createElement('mindplot-component', {
            ref: mindplotRef,
            id: 'mindmap-comp',
            mode: options.mode,
            locale: locale,
            zoom: options.zoom,
            'theme-variant': mode,
          })}

          <Notifier id="headerNotifier" />

          <TopicImageLightbox preview={imagePreview} onClose={() => setImagePreview(null)} />

          <MindmapContextMenu
            contextMenu={contextMenu}
            designer={designer}
            onClose={() => setContextMenu(null)}
            onCopyTopic={async () => {
              if (!designer) return;
              await designer.copyToClipboard();
              $notify('已复制主题（含图片与内容）');
            }}
            onCopyImage={async (imageUrl) => {
              try {
                await copyImageToClipboard(imageUrl);
                $notify('已复制图片到剪贴板');
              } catch (err) {
                $notify(err instanceof Error ? err.message : '复制图片失败');
              }
            }}
            onCopyText={async (text) => {
              try {
                await copyTextToClipboard(text);
                $notify('已复制主题内容');
              } catch (err) {
                $notify(err instanceof Error ? err.message : '复制内容失败');
              }
            }}
            onDownloadImage={async (imageUrl, title) => {
              try {
                await downloadTopicImage(imageUrl, title);
              } catch (err) {
                $notify(err instanceof Error ? err.message : '下载图片失败');
              }
            }}
            onExportBranch={
              capability.isHidden('export')
                ? undefined
                : (topicId) => {
                    if (onExportTopic) {
                      onExportTopic(topicId);
                    } else {
                      onAction('export');
                    }
                  }
            }
            onPreviewImage={(preview) => setImagePreview(preview)}
          />

          <ConfirmDeleteDialog
            open={Boolean(pendingDelete)}
            title={
              pendingDelete &&
              pendingDelete.topicCount === 0 &&
              pendingDelete.relationshipCount > 0 ? (
                <FormattedMessage
                  id="confirm-delete.relationship-title"
                  defaultMessage="Delete relationship?"
                />
              ) : (
                <FormattedMessage id="confirm-delete.topic-title" defaultMessage="Delete topic?" />
              )
            }
            message={(() => {
              if (!pendingDelete) {
                return '';
              }
              if (pendingDelete.topicCount === 0 && pendingDelete.relationshipCount > 0) {
                return (
                  <FormattedMessage
                    id="confirm-delete.relationship-message"
                    defaultMessage="Are you sure you want to delete the selected relationship? You can undo this later."
                  />
                );
              }
              if (pendingDelete.topicCount === 1) {
                const title = pendingDelete.topicTitles[0];
                if (pendingDelete.hasChildren) {
                  return title ? (
                    <FormattedMessage
                      id="confirm-delete.single-topic-with-children"
                      defaultMessage='Delete "{title}" and all of its child topics? You can undo this later.'
                      values={{ title }}
                    />
                  ) : (
                    <FormattedMessage
                      id="confirm-delete.topic-with-children"
                      defaultMessage="Delete this topic and all of its child topics? You can undo this later."
                    />
                  );
                }
                return title ? (
                  <FormattedMessage
                    id="confirm-delete.single-topic"
                    defaultMessage='Are you sure you want to delete "{title}"? You can undo this later.'
                    values={{ title }}
                  />
                ) : (
                  <FormattedMessage
                    id="confirm-delete.topic-generic"
                    defaultMessage="Are you sure you want to delete the selected topic? You can undo this later."
                  />
                );
              }
              return pendingDelete.hasChildren ? (
                <FormattedMessage
                  id="confirm-delete.multiple-topics-with-children"
                  defaultMessage="Delete the {count} selected topics and their child topics? You can undo this later."
                  values={{ count: pendingDelete.topicCount }}
                />
              ) : (
                <FormattedMessage
                  id="confirm-delete.multiple-topics"
                  defaultMessage="Delete the {count} selected topics? You can undo this later."
                  values={{ count: pendingDelete.topicCount }}
                />
              );
            })()}
            onConfirm={() => {
              const target = pendingDelete;
              setPendingDelete(null);
              target?.confirm();
            }}
            onCancel={() => setPendingDelete(null)}
          />

          {!model?.isMapLoadded() && <EditorLoadingSkeleton />}
        </IntlProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

const Editor = (props: EditorProps): ReactElement => {
  return (
    <EditorThemeProvider themeVariantStorage={props.themeVariantStorage}>
      <EditorContent {...props} />
    </EditorThemeProvider>
  );
};
export default Editor;
