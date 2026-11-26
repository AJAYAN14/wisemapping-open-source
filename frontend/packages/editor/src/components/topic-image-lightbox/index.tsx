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
import {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import Tooltip from '@mui/material/Tooltip';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import type { ImagePreviewEvent } from '@wisemapping/mindplot';
import './styles.css';

type TopicImageLightboxProps = {
  preview: ImagePreviewEvent | null;
  onClose: () => void;
};

type ViewState = {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

type NaturalSize = {
  width: number;
  height: number;
};

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  startedOnImage: boolean;
  canPan: boolean;
  moved: boolean;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const BUTTON_ZOOM_FACTOR = 1.25;
const PAN_STEP_PX = 48;
const DRAG_THRESHOLD_PX = 4;
const STAGE_PADDING_PX = 48;

const INITIAL_VIEW: ViewState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

export const clampZoom = (value: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(4))));

export const computeFitScale = (
  stageWidth: number,
  stageHeight: number,
  imageWidth: number,
  imageHeight: number,
  rotation: number,
): number => {
  if (stageWidth <= 0 || stageHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return 1;
  }
  const normalizedRot = ((rotation % 360) + 360) % 360;
  const swapped = normalizedRot === 90 || normalizedRot === 270;
  const effW = swapped ? imageHeight : imageWidth;
  const effH = swapped ? imageWidth : imageHeight;
  const availW = Math.max(stageWidth - STAGE_PADDING_PX, 120);
  const availH = Math.max(stageHeight - STAGE_PADDING_PX, 120);
  return clampZoom(Math.min(availW / effW, availH / effH));
};

export const computeInitialScale = (fitScale: number): number =>
  fitScale < 1 ? fitScale : 1;

const computeAnchoredOffset = (
  current: ViewState,
  nextScale: number,
  clientX: number,
  clientY: number,
  stageRect: DOMRect,
): { offsetX: number; offsetY: number } => {
  if (stageRect.width <= 0 || stageRect.height <= 0 || current.scale <= 0) {
    return { offsetX: current.offsetX, offsetY: current.offsetY };
  }
  const centerX = stageRect.left + stageRect.width / 2;
  const centerY = stageRect.top + stageRect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const ratio = nextScale / current.scale;
  return {
    offsetX: dx - (dx - current.offsetX) * ratio,
    offsetY: dy - (dy - current.offsetY) * ratio,
  };
};

const isPointOutsideRect = (clientX: number, clientY: number, rect: DOMRect): boolean =>
  clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;

const TopicImageLightboxContent = ({
  preview,
  onClose,
}: {
  preview: ImagePreviewEvent;
  onClose: () => void;
}): ReactElement => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);

  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null);
  const [checkerBg, setCheckerBg] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') {
      dialog.close();
    } else {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
    }

    // Fallback for browsers without <dialog closedby="any"> support (e.g. Safari)
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const handlePointerDown = (event: PointerEvent) => {
        pressedOutside = isPointOutsideRect(event.clientX, event.clientY, dialog.getBoundingClientRect());
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (pressedOutside && isPointOutsideRect(event.clientX, event.clientY, dialog.getBoundingClientRect())) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointerup', handlePointerUp);
      return () => {
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerup', handlePointerUp);
      };
    }
    return undefined;
  }, []);

  const getFitScaleFor = useCallback(
    (size: NaturalSize | null, rotation: number): number => {
      const stage = stageRef.current!;
      if (!size) {
        return 1;
      }
      return computeFitScale(stage.clientWidth, stage.clientHeight, size.width, size.height, rotation);
    },
    [],
  );

  const zoomAtStagePoint = useCallback(
    (targetScale: number, clientX?: number, clientY?: number) => {
      const stage = stageRef.current;
      const nextScale = clampZoom(targetScale);
      setView((prev) => {
        if (nextScale === prev.scale) {
          return prev;
        }
        if (stage && clientX !== undefined && clientY !== undefined) {
          const rect = stage.getBoundingClientRect();
          const anchored = computeAnchoredOffset(prev, nextScale, clientX, clientY, rect);
          return { ...prev, scale: nextScale, ...anchored };
        }
        return { ...prev, scale: nextScale };
      });
    },
    [],
  );

  useEffect(() => {
    const stage = stageRef.current!;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const clampedDelta = Math.max(-120, Math.min(120, event.deltaY));
      const factor = Math.exp(-clampedDelta * 0.0025);
      setView((prev) => {
        const nextScale = clampZoom(prev.scale * factor);
        if (nextScale === prev.scale) {
          return prev;
        }
        const anchored = computeAnchoredOffset(
          prev,
          nextScale,
          event.clientX,
          event.clientY,
          stage.getBoundingClientRect(),
        );
        return { ...prev, scale: nextScale, ...anchored };
      });
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleZoomIn = () => zoomAtStagePoint(view.scale * BUTTON_ZOOM_FACTOR);
  const handleZoomOut = () => zoomAtStagePoint(view.scale / BUTTON_ZOOM_FACTOR);

  const handleFit = useCallback(() => {
    setView((prev) => ({
      ...prev,
      scale: getFitScaleFor(naturalSize, prev.rotation),
      offsetX: 0,
      offsetY: 0,
    }));
  }, [getFitScaleFor, naturalSize]);

  const handleActualSize = useCallback(() => {
    setView((prev) => ({
      ...prev,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }));
  }, []);

  const handleReset = useCallback(() => {
    const fit = getFitScaleFor(naturalSize, 0);
    setView({
      scale: computeInitialScale(fit),
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
    });
  }, [getFitScaleFor, naturalSize]);

  const handleToggleZoomBadge = () => {
    const fit = getFitScaleFor(naturalSize, view.rotation);
    const isNearOne = Math.abs(view.scale - 1) < 0.02;
    setView((prev) => ({
      ...prev,
      scale: isNearOne ? fit : 1,
      offsetX: 0,
      offsetY: 0,
    }));
  };

  const handleRotate = useCallback(
    (deltaDeg = 90) => {
      setView((prev) => {
        const nextRotation = (prev.rotation + deltaDeg + 360) % 360;
        return {
          ...prev,
          rotation: nextRotation,
          offsetX: 0,
          offsetY: 0,
        };
      });
    },
    [],
  );

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      setNaturalSize(size);
      const fit = getFitScaleFor(size, 0);
      setView({
        scale: computeInitialScale(fit),
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
      });
    }
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLImageElement>) => {
    event.stopPropagation();
    const fit = getFitScaleFor(naturalSize, view.rotation);
    const baseScale = computeInitialScale(fit);
    if (view.scale <= baseScale + 0.05) {
      const targetScale = clampZoom(Math.max(2, baseScale * 2));
      zoomAtStagePoint(targetScale, event.clientX, event.clientY);
    } else {
      setView((prev) => ({ ...prev, scale: baseScale, offsetX: 0, offsetY: 0 }));
    }
  };

  const isPannable = useCallback(
    (currentView: ViewState): boolean => {
      const stage = stageRef.current;
      if (!stage || !naturalSize) {
        return currentView.scale > 1 || currentView.offsetX !== 0 || currentView.offsetY !== 0;
      }
      const normalizedRot = ((currentView.rotation % 360) + 360) % 360;
      const swapped = normalizedRot === 90 || normalizedRot === 270;
      const renderedW = (swapped ? naturalSize.height : naturalSize.width) * currentView.scale;
      const renderedH = (swapped ? naturalSize.width : naturalSize.height) * currentView.scale;
      return (
        renderedW > stage.clientWidth ||
        renderedH > stage.clientHeight ||
        currentView.offsetX !== 0 ||
        currentView.offsetY !== 0
      );
    },
    [naturalSize],
  );

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    const startedOnImage = target === imgRef.current;
    const canPan = startedOnImage || isPannable(view);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: view.offsetX,
      startOffsetY: view.offsetY,
      startedOnImage,
      canPan,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId || !session.canPan) {
      return;
    }
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      session.moved = true;
      setIsDragging(true);
    }
    if (session.moved) {
      setView((prev) => ({
        ...prev,
        offsetX: session.startOffsetX + dx,
        offsetY: session.startOffsetY + dy,
      }));
    }
  };

  const handleStagePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (!session.moved && !session.startedOnImage) {
      requestClose();
    }
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomAtStagePoint(view.scale * BUTTON_ZOOM_FACTOR);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomAtStagePoint(view.scale / BUTTON_ZOOM_FACTOR);
    } else if (event.key === '0') {
      event.preventDefault();
      handleFit();
    } else if (event.key === '1') {
      event.preventDefault();
      handleActualSize();
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      handleRotate(event.shiftKey ? -90 : 90);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setView((prev) => ({ ...prev, offsetX: prev.offsetX + PAN_STEP_PX }));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setView((prev) => ({ ...prev, offsetX: prev.offsetX - PAN_STEP_PX }));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setView((prev) => ({ ...prev, offsetY: prev.offsetY + PAN_STEP_PX }));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setView((prev) => ({ ...prev, offsetY: prev.offsetY - PAN_STEP_PX }));
    }
  };

  const handleNativeClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  };

  const fitScale = getFitScaleFor(naturalSize, view.rotation);
  const initialScale = computeInitialScale(fitScale);
  const isAtDefault =
    Math.abs(view.scale - initialScale) < 0.01 &&
    view.offsetX === 0 &&
    view.offsetY === 0 &&
    view.rotation === 0;
  const isAtFit =
    Math.abs(view.scale - fitScale) < 0.01 && view.offsetX === 0 && view.offsetY === 0;
  const pannable = isPannable(view);
  const zoomPercent = Math.round(view.scale * 100);
  const titleText = preview.title || '主题配图';

  return (
    <dialog
      ref={dialogRef}
      className="topic-image-lightbox"
      aria-labelledby={titleId}
      onClose={handleNativeClose}
      onKeyDown={handleDialogKeyDown}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <header className="topic-image-lightbox__toolbar">
        <div className="topic-image-lightbox__meta-group">
          <h1 id={titleId} className="topic-image-lightbox__title">
            {titleText}
          </h1>
          {naturalSize && (
            <span className="topic-image-lightbox__dimensions">
              {naturalSize.width} × {naturalSize.height}
            </span>
          )}
        </div>

        <div className="topic-image-lightbox__actions">
          <Tooltip title="缩小 (-)">
            <span>
              <button
                type="button"
                className="topic-image-lightbox__btn"
                aria-label="缩小"
                onClick={handleZoomOut}
                disabled={view.scale <= MIN_ZOOM}
              >
                <ZoomOutRoundedIcon fontSize="small" aria-hidden="true" />
              </button>
            </span>
          </Tooltip>

          <Tooltip title="切换 1:1 / 适应窗口">
            <button
              type="button"
              className="topic-image-lightbox__btn topic-image-lightbox__zoom-btn"
              aria-label={`当前缩放 ${zoomPercent}%，点击切换 1:1 与适应窗口`}
              onClick={handleToggleZoomBadge}
            >
              {zoomPercent}%
            </button>
          </Tooltip>

          <Tooltip title="放大 (+)">
            <span>
              <button
                type="button"
                className="topic-image-lightbox__btn"
                aria-label="放大"
                onClick={handleZoomIn}
                disabled={view.scale >= MAX_ZOOM}
              >
                <ZoomInRoundedIcon fontSize="small" aria-hidden="true" />
              </button>
            </span>
          </Tooltip>

          <Tooltip title="适应窗口 (0)">
            <span>
              <button
                type="button"
                className={`topic-image-lightbox__btn ${isAtFit ? 'topic-image-lightbox__btn--active' : ''}`}
                aria-label="适应窗口"
                aria-pressed={isAtFit}
                onClick={handleFit}
              >
                <FitScreenRoundedIcon fontSize="small" aria-hidden="true" />
              </button>
            </span>
          </Tooltip>

          <Tooltip title="重置视图">
            <span>
              <button
                type="button"
                className="topic-image-lightbox__btn"
                aria-label="重置大小"
                onClick={handleReset}
                disabled={isAtDefault}
              >
                <RestartAltRoundedIcon fontSize="small" aria-hidden="true" />
              </button>
            </span>
          </Tooltip>

          <span className="topic-image-lightbox__divider" aria-hidden="true" />

          <Tooltip title="旋转 90° (R)">
            <button
              type="button"
              className="topic-image-lightbox__btn"
              aria-label="旋转 90 度"
              onClick={() => handleRotate(90)}
            >
              <RotateRightRoundedIcon fontSize="small" aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip title={checkerBg ? '切换深色底' : '切换浅色棋盘格底（便于查看透明图）'}>
            <button
              type="button"
              className={`topic-image-lightbox__btn ${checkerBg ? 'topic-image-lightbox__btn--active' : ''}`}
              aria-label="切换画布底色"
              aria-pressed={checkerBg}
              onClick={() => setCheckerBg((prev) => !prev)}
            >
              <GridOnRoundedIcon fontSize="small" aria-hidden="true" />
            </button>
          </Tooltip>

          {!preview.url.startsWith('data:') && (
            <Tooltip title="新标签页打开">
              <a
                className="topic-image-lightbox__btn"
                aria-label="新标签页打开"
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
              </a>
            </Tooltip>
          )}

          <Tooltip title="关闭 (Esc)">
            <button
              type="button"
              className="topic-image-lightbox__btn"
              aria-label="关闭"
              autoFocus
              onClick={requestClose}
            >
              <CloseRoundedIcon fontSize="small" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </header>

      <div
        ref={stageRef}
        className={[
          'topic-image-lightbox__stage',
          pannable ? 'topic-image-lightbox__stage--pannable' : '',
          isDragging ? 'topic-image-lightbox__stage--dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerEnd}
        onPointerCancel={handleStagePointerEnd}
      >
        <div
          className={[
            'topic-image-lightbox__canvas',
            isDragging ? '' : 'topic-image-lightbox__canvas--animated',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            transform: `translate3d(${view.offsetX}px, ${view.offsetY}px, 0) scale(${view.scale}) rotate(${view.rotation}deg)`,
          }}
        >
          <img
            ref={imgRef}
            src={preview.url}
            alt={preview.title || '主题配图预览'}
            draggable={false}
            onLoad={handleImageLoad}
            onDoubleClick={handleDoubleClick}
            className={[
              'topic-image-lightbox__img',
              naturalSize ? '' : 'topic-image-lightbox__img--unmeasured',
              checkerBg ? 'topic-image-lightbox__img--checker' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              naturalSize
                ? { width: `${naturalSize.width}px`, height: `${naturalSize.height}px` }
                : undefined
            }
          />
        </div>

        <div className="topic-image-lightbox__hint" aria-hidden="true">
          滚轮缩放 · 拖拽移动 · 双击放大 · 空白处或 Esc 关闭
        </div>
      </div>
    </dialog>
  );
};

const TopicImageLightbox = ({ preview, onClose }: TopicImageLightboxProps): ReactElement | null => {
  if (!preview) {
    return null;
  }
  return <TopicImageLightboxContent key={preview.url} preview={preview} onClose={onClose} />;
};

export default TopicImageLightbox;
