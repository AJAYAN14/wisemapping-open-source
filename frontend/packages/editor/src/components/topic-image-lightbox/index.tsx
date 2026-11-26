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
import { ReactElement, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { ImagePreviewEvent } from '@wisemapping/mindplot';

type TopicImageLightboxProps = {
  preview: ImagePreviewEvent | null;
  onClose: () => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.5;

const TopicImageLightboxContent = ({
  preview,
  onClose,
}: {
  preview: ImagePreviewEvent;
  onClose: () => void;
}): ReactElement => {
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))));
  const handleReset = () => setZoom(1);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            backgroundColor: 'rgba(18, 18, 22, 0.94)',
            backdropFilter: 'blur(12px)',
            color: '#F4F4F5',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
            m: { xs: 1.5, sm: 3 },
            maxWidth: '94vw',
            maxHeight: '92vh',
            overflow: 'hidden',
          },
        },
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(4px)',
          },
        },
      }}
    >
      {/* Top Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          px: 2,
          py: 1,
          borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
        }}
      >
        <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" noWrap sx={{ color: '#F4F4F5', fontWeight: 600 }}>
            {preview.title || '主题配图'}
          </Typography>
          {naturalSize && (
            <Typography variant="caption" sx={{ color: 'rgba(244, 244, 245, 0.6)', flexShrink: 0 }}>
              {naturalSize.width} × {naturalSize.height}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Tooltip title="缩小">
            <span>
              <IconButton
                size="small"
                aria-label="缩小"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                sx={{ color: '#E4E4E7' }}
              >
                <ZoomOutRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            sx={{ minWidth: 42, textAlign: 'center', color: '#E4E4E7', fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(zoom * 100)}%
          </Typography>
          <Tooltip title="放大">
            <span>
              <IconButton
                size="small"
                aria-label="放大"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                sx={{ color: '#E4E4E7' }}
              >
                <ZoomInRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="重置大小">
            <span>
              <IconButton
                size="small"
                aria-label="重置大小"
                onClick={handleReset}
                disabled={zoom === 1}
                sx={{ color: '#E4E4E7' }}
              >
                <RestartAltRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {!preview.url.startsWith('data:') && (
            <Tooltip title="新标签页打开">
              <IconButton
                size="small"
                aria-label="新标签页打开"
                component="a"
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: '#E4E4E7' }}
              >
                <OpenInNewRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="关闭">
            <IconButton size="small" aria-label="关闭" onClick={onClose} sx={{ color: '#E4E4E7', ml: 0.5 }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Image Viewport */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          p: { xs: 1.5, sm: 2.5 },
          minWidth: { xs: '78vw', sm: 360 },
          minHeight: 220,
          maxWidth: '94vw',
          maxHeight: '80vh',
        }}
      >
        <Box
          component="img"
          src={preview.url}
          alt={preview.title || '主题配图预览'}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
          sx={{
            maxWidth: zoom === 1 ? '88vw' : 'none',
            maxHeight: zoom === 1 ? '74vh' : 'none',
            width: zoom === 1 ? 'auto' : naturalSize ? `${Math.round(naturalSize.width * zoom)}px` : undefined,
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '8px',
            cursor: zoom === 1 ? 'zoom-in' : 'zoom-out',
            transition: 'width 0.16s ease',
            userSelect: 'none',
          }}
        />
      </Box>
    </Dialog>
  );
};

const TopicImageLightbox = ({ preview, onClose }: TopicImageLightboxProps): ReactElement | null => {
  if (!preview) {
    return null;
  }
  return <TopicImageLightboxContent key={preview.url} preview={preview} onClose={onClose} />;
};

export default TopicImageLightbox;
