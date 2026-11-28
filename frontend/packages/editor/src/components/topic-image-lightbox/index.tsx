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
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import { $notify, ImagePreviewEvent } from '@wisemapping/mindplot';
import { copyImageToClipboard, downloadTopicImage } from '../../utils/topicImageClipboard';
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

type PinchSession = {
  initialDistance: number;
  startScale: number;
  startOffsetX: number;
  startOffsetY: number;
  startMidX: number;
  startMidY: number;
};

type PointerPoint = {
  clientX: number;
  clientY: number;
};

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const BUTTON_ZOOM_FACTOR = 1.25;
const PAN_STEP_PX = 48;
const DRAG_THRESHOLD_PX = 4;
const STAGE_PADDING_PX = 48;
const COMPACT_STAGE_PADDING_PX = 24;

const INITIAL_VIEW: ViewState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

export const clampZoom = (value: number, minZoom = MIN_ZOOM): number =>
  Math.min(MAX_ZOOM, Math.max(minZoom, Number(value.toFixed(4))));

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
  const padding = stageWidth < 520 || stageHeight < 520 ? COMPACT_STAGE_PADDING_PX : STAGE_PADDING_PX;
  const availW = Math.max(stageWidth - padding, 120);
  const availH = Math.max(stageHeight - padding, 120);
  const rawFit = Math.min(availW / effW, availH / effH);
  return clampZoom(rawFit, Math.min(MIN_ZOOM, Math.max(0.01, rawFit)));
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
  const pinchRef = useRef<PinchSession | null>(null);
  const activePointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const hadMultiTouchRef = useRef(false);

  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const viewRef = useRef<ViewState>(INITIAL_VIEW);
  const minZoomRef = useRef<number>(MIN_ZOOM);
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null);
  const [baseScale, setBaseScale] = useState<number>(1);
  const [checkerBg, setCheckerBg] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedRecently, setCopiedRecently] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const updateView = useCallback((updater: ViewState | ((prev: ViewState) => ViewState)) => {
    setView((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      viewRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

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
      const nextScale = clampZoom(targetScale, minZoomRef.current);
      updateView((prev) => {
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
    [updateView],
  );

  useEffect(() => {
    const stage = stageRef.current!;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const clampedDelta = Math.max(-120, Math.min(120, event.deltaY));
      const factor = Math.exp(-clampedDelta * 0.0025);
      updateView((prev) => {
        const nextScale = clampZoom(prev.scale * factor, minZoomRef.current);
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
  }, [updateView]);

  const handleZoomIn = () => zoomAtStagePoint(view.scale * BUTTON_ZOOM_FACTOR);
  const handleZoomOut = () => zoomAtStagePoint(view.scale / BUTTON_ZOOM_FACTOR);

  const handleFit = useCallback(() => {
    updateView((prev) => ({
      ...prev,
      scale: getFitScaleFor(naturalSize, prev.rotation),
      offsetX: 0,
      offsetY: 0,
    }));
  }, [getFitScaleFor, naturalSize, updateView]);

  const handleActualSize = useCallback(() => {
    updateView((prev) => ({
      ...prev,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }));
  }, [updateView]);

  const handleReset = useCallback(() => {
    const fit = getFitScaleFor(naturalSize, 0);
    updateView({
      scale: computeInitialScale(fit),
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
    });
  }, [getFitScaleFor, naturalSize, updateView]);

  const handleToggleZoomBadge = () => {
    const fit = getFitScaleFor(naturalSize, view.rotation);
    const isNearOne = Math.abs(view.scale - 1) < 0.02;
    updateView((prev) => ({
      ...prev,
      scale: isNearOne ? fit : 1,
      offsetX: 0,
      offsetY: 0,
    }));
  };

  const handleRotate = useCallback(
    (deltaDeg = 90) => {
      updateView((prev) => {
        const nextRotation = (prev.rotation + deltaDeg + 360) % 360;
        return {
          ...prev,
          rotation: nextRotation,
          offsetX: 0,
          offsetY: 0,
        };
      });
    },
    [updateView],
  );

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      setNaturalSize(size);
      const fit = getFitScaleFor(size, 0);
      const initial = computeInitialScale(fit);
      minZoomRef.current = Math.min(MIN_ZOOM, fit);
      setBaseScale(initial);
      updateView({
        scale: initial,
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
      const targetScale = clampZoom(Math.max(2, baseScale * 2), minZoomRef.current);
      zoomAtStagePoint(targetScale, event.clientX, event.clientY);
    } else {
      updateView((prev) => ({ ...prev, scale: baseScale, offsetX: 0, offsetY: 0 }));
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
    if (event.pointerType !== 'touch' && event.button !== 0) {
      return;
    }

    const pointers = activePointersRef.current;
    pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (pointers.size >= 2) {
      hadMultiTouchRef.current = true;
      dragRef.current = null;
      const pts = Array.from(pointers.values());
      const p1 = pts[0]!;
      const p2 = pts[1]!;
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const current = viewRef.current;
      pinchRef.current = {
        initialDistance: Math.max(dist, 1),
        startScale: current.scale,
        startOffsetX: current.offsetX,
        startOffsetY: current.offsetY,
        startMidX: (p1.clientX + p2.clientX) / 2,
        startMidY: (p1.clientY + p2.clientY) / 2,
      };
      setIsDragging(true);
      return;
    }

    hadMultiTouchRef.current = false;
    const target = event.target as HTMLElement;
    const startedOnImage = target === imgRef.current;
    const current = viewRef.current;
    const canPan = startedOnImage || isPannable(current);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: current.offsetX,
      startOffsetY: current.offsetY,
      startedOnImage,
      canPan,
      moved: false,
    };
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = activePointersRef.current;
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    const pinch = pinchRef.current;
    if (pointers.size >= 2 && pinch) {
      const pts = Array.from(pointers.values());
      const p1 = pts[0]!;
      const p2 = pts[1]!;
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const midX = (p1.clientX + p2.clientX) / 2;
      const midY = (p1.clientY + p2.clientY) / 2;
      const nextScale = clampZoom(
        pinch.startScale * (Math.max(dist, 1) / pinch.initialDistance),
        minZoomRef.current,
      );
      const rect = stageRef.current?.getBoundingClientRect();
      updateView((prev) => {
        if (!rect || rect.width <= 0 || rect.height <= 0 || pinch.startScale <= 0) {
          return { ...prev, scale: nextScale };
        }
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const ratio = nextScale / pinch.startScale;
        return {
          ...prev,
          scale: nextScale,
          offsetX: midX - centerX - (pinch.startMidX - centerX - pinch.startOffsetX) * ratio,
          offsetY: midY - centerY - (pinch.startMidY - centerY - pinch.startOffsetY) * ratio,
        };
      });
      return;
    }

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
      updateView((prev) => ({
        ...prev,
        offsetX: session.startOffsetX + dx,
        offsetY: session.startOffsetY + dy,
      }));
    }
  };

  const handleStagePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = activePointersRef.current;
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (pinchRef.current) {
      if (pointers.size >= 2) {
        const pts = Array.from(pointers.values());
        const p1 = pts[0]!;
        const p2 = pts[1]!;
        const current = viewRef.current;
        pinchRef.current = {
          initialDistance: Math.max(Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY), 1),
          startScale: current.scale,
          startOffsetX: current.offsetX,
          startOffsetY: current.offsetY,
          startMidX: (p1.clientX + p2.clientX) / 2,
          startMidY: (p1.clientY + p2.clientY) / 2,
        };
        return;
      }

      pinchRef.current = null;
      if (pointers.size === 1) {
        const [remId, remPt] = Array.from(pointers.entries())[0]!;
        const current = viewRef.current;
        dragRef.current = {
          pointerId: remId,
          startX: remPt.clientX,
          startY: remPt.clientY,
          startOffsetX: current.offsetX,
          startOffsetY: current.offsetY,
          startedOnImage: true,
          canPan: true,
          moved: true,
        };
        return;
      }

      dragRef.current = null;
      setIsDragging(false);
      return;
    }

    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    setIsDragging(false);

    if (!session.moved && !session.startedOnImage && !hadMultiTouchRef.current) {
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
      updateView((prev) => ({ ...prev, offsetX: prev.offsetX + PAN_STEP_PX }));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updateView((prev) => ({ ...prev, offsetX: prev.offsetX - PAN_STEP_PX }));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      updateView((prev) => ({ ...prev, offsetY: prev.offsetY + PAN_STEP_PX }));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      updateView((prev) => ({ ...prev, offsetY: prev.offsetY - PAN_STEP_PX }));
    }
  };

  const handleNativeClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  };

  const handleCopyImage = () => {
    void copyImageToClipboard(preview.url)
      .then(() => {
        setCopiedRecently(true);
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = window.setTimeout(() => {
          setCopiedRecently(false);
        }, 1800);
        $notify('已复制图片到剪贴板');
      })
      .catch((err) => {
        $notify(err instanceof Error ? err.message : '复制图片失败');
      });
  };

  const handleDownloadImage = () => {
    void downloadTopicImage(preview.url, preview.title).catch((err) => {
      $notify(err instanceof Error ? err.message : '下载图片失败');
    });
  };

  const fitScale = getFitScaleFor(naturalSize, view.rotation);
  const minZoom = Math.min(MIN_ZOOM, fitScale);
  minZoomRef.current = minZoom;
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
  const visualScale = baseScale > 0 ? view.scale / baseScale : view.scale;
  const displayWidth = naturalSize ? Math.max(1, Math.round(naturalSize.width * baseScale)) : undefined;
  const displayHeight = naturalSize ? Math.max(1, Math.round(naturalSize.height * baseScale)) : undefined;

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
                disabled={view.scale <= minZoom}
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

          <Tooltip title={copiedRecently ? '已复制图片' : '复制图片'}>
            <button
              type="button"
              className={`topic-image-lightbox__btn ${copiedRecently ? 'topic-image-lightbox__btn--active' : ''}`}
              aria-label="复制图片"
              onClick={handleCopyImage}
            >
              {copiedRecently ? (
                <CheckRoundedIcon fontSize="small" aria-hidden="true" />
              ) : (
                <ContentCopyRoundedIcon fontSize="small" aria-hidden="true" />
              )}
            </button>
          </Tooltip>

          <Tooltip title="下载图片">
            <button
              type="button"
              className="topic-image-lightbox__btn"
              aria-label="下载图片"
              onClick={handleDownloadImage}
            >
              <DownloadRoundedIcon fontSize="small" aria-hidden="true" />
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
        </div>

        <Tooltip title="关闭 (Esc)">
          <button
            type="button"
            className="topic-image-lightbox__btn topic-image-lightbox__close-btn"
            aria-label="关闭"
            autoFocus
            onClick={requestClose}
          >
            <CloseRoundedIcon fontSize="small" aria-hidden="true" />
          </button>
        </Tooltip>
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
            transform: `translate3d(${view.offsetX}px, ${view.offsetY}px, 0) scale(${visualScale}) rotate(${view.rotation}deg)`,
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
              displayWidth && displayHeight
                ? { width: `${displayWidth}px`, height: `${displayHeight}px` }
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
