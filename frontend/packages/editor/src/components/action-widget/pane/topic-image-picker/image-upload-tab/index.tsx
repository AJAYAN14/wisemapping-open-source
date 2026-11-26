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
import React, { ReactElement, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { FormattedMessage } from 'react-intl';
import type { TopicImageValue } from '@wisemapping/mindplot';
import NodeProperty from '../../../../../classes/model/node-property';
import type { UploadTopicImageFn } from '../../../../../hooks/useEditor';
import {
  blobToDataUrl,
  compressTopicImage,
  replaceFilenameExtension,
} from '../../../../../utils/imageAssetUtils';
import TopicImageLightbox from '../../../../topic-image-lightbox';
import ConfirmDeleteDialog from '../../../../confirm-delete-dialog';

type ImageUploadTabProps = {
  topicImageModel?: NodeProperty<TopicImageValue | undefined> | undefined;
  onUploadTopicImage?: UploadTopicImageFn | undefined;
  onImageApplied?: (() => void) | undefined;
};

const ImageUploadTab = ({
  topicImageModel,
  onUploadTopicImage,
  onImageApplied,
}: ImageUploadTabProps): ReactElement => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const currentImage = topicImageModel?.getValue();
  const canEdit = Boolean(topicImageModel?.setValue);

  const handleFile = async (file: File | Blob, filename?: string): Promise<void> => {
    if (!canEdit || !topicImageModel?.setValue) {
      return;
    }
    setErrorMsg(null);
    setUploading(true);
    try {
      const compressed = await compressTopicImage(file);
      const targetFilename =
        compressed.mimeType === 'image/avif'
          ? replaceFilenameExtension(filename, 'avif', 'image')
          : filename;
      let nextImage: TopicImageValue;
      if (onUploadTopicImage) {
        nextImage = await onUploadTopicImage(compressed.blob, targetFilename, {
          width: compressed.width,
          height: compressed.height,
        });
      } else {
        const dataUrl = await blobToDataUrl(compressed.blob);
        nextImage = {
          url: dataUrl,
          width: compressed.width,
          height: compressed.height,
        };
      }
      topicImageModel.setValue(nextImage);
      onImageApplied?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '图片上传失败，请稍后重试。');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      void handleFile(file, file.name);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file, file.name);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          void handleFile(file, file.name || 'pasted-image.png');
          break;
        }
      }
    }
  };

  const handleRemoveImage = () => {
    if (!topicImageModel?.setValue) {
      return;
    }
    setErrorMsg(null);
    topicImageModel.setValue(undefined);
  };

  return (
    <Box
      onPaste={handlePaste}
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
        justifyContent: 'space-between',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        hidden
        onChange={handleInputChange}
      />

      <Box
        role="button"
        tabIndex={0}
        aria-label="选择或拖拽图片上传"
        onClick={() => !uploading && canEdit && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading && canEdit) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        sx={(theme) => ({
          flex: 1,
          minHeight: 140,
          borderRadius: '12px',
          border: `1.5px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
          backgroundColor: isDragging ? theme.palette.action.selected : theme.palette.action.hover,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          p: 2,
          textAlign: 'center',
          cursor: canEdit && !uploading ? 'pointer' : 'default',
          transition: 'border-color 160ms ease, background-color 160ms ease',
        })}
      >
        {uploading ? (
          <>
            <CircularProgress size={26} />
            <Typography variant="body2" color="text.secondary">
              <FormattedMessage
                id="topic-image.uploading"
                defaultMessage="正在处理并上传至云端存储..."
              />
            </Typography>
          </>
        ) : (
          <>
            <CloudUploadRoundedIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              <FormattedMessage
                id="topic-image.choose-file"
                defaultMessage="点击选择图片，或拖拽图片到此处"
              />
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <FormattedMessage
                id="topic-image.paste-hint"
                defaultMessage="支持选中节点后 Ctrl+V 粘贴截图 · ≥150 KB 或 GIF 自动转静态高画质 AVIF"
              />
            </Typography>
          </>
        )}
      </Box>

      {errorMsg && (
        <Typography role="alert" variant="caption" color="error" sx={{ px: 0.5 }}>
          {errorMsg}
        </Typography>
      )}

      {currentImage && (
        <Box
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            p: 1,
            borderRadius: '10px',
            border: `1px solid ${theme.palette.divider}`,
          })}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box
              component="img"
              src={currentImage.url}
              alt="当前节点配图"
              title="点击查看大图"
              onClick={() => setPreviewOpen(true)}
              sx={{
                width: 44,
                height: 32,
                objectFit: 'cover',
                borderRadius: '6px',
                flexShrink: 0,
                cursor: 'zoom-in',
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              onClick={() => setPreviewOpen(true)}
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              查看大图
            </Typography>
          </Box>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
            disabled={!canEdit || uploading}
            onClick={() => setConfirmRemoveOpen(true)}
          >
            <FormattedMessage id="topic-image.remove" defaultMessage="移除图片" />
          </Button>
        </Box>
      )}

      <TopicImageLightbox
        preview={previewOpen && currentImage ? { url: currentImage.url } : null}
        onClose={() => setPreviewOpen(false)}
      />
      <ConfirmDeleteDialog
        open={confirmRemoveOpen}
        title={<FormattedMessage id="confirm-delete.image-title" defaultMessage="Remove image?" />}
        message={
          <FormattedMessage
            id="confirm-delete.image-message"
            defaultMessage="Are you sure you want to remove the image from this topic?"
          />
        }
        onConfirm={() => {
          setConfirmRemoveOpen(false);
          handleRemoveImage();
        }}
        onCancel={() => setConfirmRemoveOpen(false)}
      />
    </Box>
  );
};

export default ImageUploadTab;
