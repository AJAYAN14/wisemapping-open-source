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

import React, { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { APPLE_FONT_STACK, RADIUS_LG, RADIUS_MD, appleColors, isDarkTheme } from '../appleDesign';
import type { FolderDirectCount } from './model';
import {
  ActionIconButton,
  BodyCell,
  BreadcrumbBar,
  BreadcrumbChip,
  BreadcrumbMarqueeText,
  BreadcrumbMarqueeViewport,
  BreadcrumbMeasureStrip,
  BreadcrumbOverflowButton,
  BreadcrumbTrail,
  CardTitle,
  CellText,
  CompactCardHeader,
  FolderGlyphBadge,
  FolderGridCardPreview,
  GridCardActionsOverlay,
  GridCardBody,
  GridCardMeta,
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

/** Layered sky-blue macOS folder SVG used exclusively inside grid view folder cards. */
const GridFolderSvgIcon = (): React.ReactElement => {
  const svgInstanceId = useId().replace(/:/g, '');
  const backId = `folder-back-${svgInstanceId}`;
  const frontId = `folder-front-${svgInstanceId}`;
  const edgeId = `folder-edge-${svgInstanceId}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="112"
      height="112"
      viewBox="0 0 128 128"
      aria-hidden="true"
      data-testid="folder-grid-svg-icon"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={backId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7BD0F7" />
          <stop offset="100%" stopColor="#299FD9" />
        </linearGradient>

        <linearGradient id={frontId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#98DFFF" />
          <stop offset="45%" stopColor="#70CEF8" />
          <stop offset="100%" stopColor="#42B5ED" />
        </linearGradient>

        <linearGradient id={edgeId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D7F4FF" stopOpacity="0.85" />
          <stop offset="25%" stopColor="#C1EDFF" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#75CFF6" stopOpacity="0" />
          <stop offset="100%" stopColor="#218DC8" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* 背板 */}
      <path
        d="M9 34 Q9 23 20 23 H43 Q48 23 52 28 L56 32 Q59 35 64 35 H108 Q119 35 119 46 V95 Q119 105 108 105 H20 Q9 105 9 94 Z"
        fill={`url(#${backId})`}
      />

      {/* 夹层 */}
      <rect x="14" y="40" width="100" height="54" rx="7" fill="#DDF3FF" />

      {/* 前板 */}
      <rect x="7" y="47" width="114" height="61" rx="11" fill={`url(#${frontId})`} />

      {/* 连续渐变边缘 */}
      <rect
        x="7.65"
        y="47.65"
        width="112.7"
        height="59.7"
        rx="10.35"
        fill="none"
        stroke={`url(#${edgeId})`}
        strokeWidth="1.3"
      />
    </svg>
  );
};

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
      dragTarget={isDragTarget}
      onClick={() => onOpenFolder(folder.id)}
      onContextMenu={(e) => onContextMenu(folder, e)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid={`folder-grid-card-${folder.id}`}
    >
      <FolderGridCardPreview>
        <GridFolderSvgIcon />
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
      </FolderGridCardPreview>

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
              <IconButton aria-label={`操作文件夹 ${folder.name}`} onClick={handleOpenMenu}>
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

export interface BreadcrumbFitResult {
  startIndex: number;
  marqueeLast: boolean;
}

/**
 * Computes the earliest breadcrumb index that fits inside `availableWidth` from right to left.
 * When `availableWidth <= 0` (e.g. unmeasured / jsdom), shows the full trail without collapsing.
 */
export function computeVisibleBreadcrumbStart(
  itemWidths: number[],
  availableWidth: number,
  separatorWidth: number,
  overflowButtonWidth: number,
): BreadcrumbFitResult {
  const count = itemWidths.length;
  if (count === 0 || availableWidth <= 0) {
    return { startIndex: 0, marqueeLast: false };
  }

  let totalAll = (count - 1) * separatorWidth;
  for (let i = 0; i < count; i += 1) {
    totalAll += itemWidths[i] ?? 0;
  }
  if (totalAll <= availableWidth + 1) {
    return { startIndex: 0, marqueeLast: false };
  }

  const remaining = Math.max(0, availableWidth - overflowButtonWidth - separatorWidth);
  for (let start = 1; start < count; start += 1) {
    let width = (count - 1 - start) * separatorWidth;
    for (let i = start; i < count; i += 1) {
      width += itemWidths[i] ?? 0;
    }
    if (width <= remaining + 1) {
      return { startIndex: start, marqueeLast: false };
    }
  }

  return { startIndex: count - 1, marqueeLast: true };
}

interface BreadcrumbPathItem {
  key: string;
  folderId: number | null;
  label: string;
  isRoot: boolean;
}

/** Compact path navigation shown inside subdirectories, supporting clicks, map drops, and dynamic overflow. */
export const FolderBreadcrumbsBar = ({
  folders,
  currentFolderId,
  onNavigate,
  onDropMaps,
}: FolderBreadcrumbsBarProps): React.ReactElement => {
  const chain = getFolderBreadcrumbs(folders, currentFolderId);
  const parentFolderId = chain.length > 1 ? chain[chain.length - 2]!.id : null;

  const items = useMemo<BreadcrumbPathItem[]>(
    () => [
      { key: 'root', folderId: null, label: '根目录', isRoot: true },
      ...chain.map((crumb) => ({
        key: String(crumb.id),
        folderId: crumb.id,
        label: crumb.name,
        isRoot: false,
      })),
    ],
    [chain],
  );

  const trailRef = useRef<HTMLDivElement>(null);
  const overflowMeasureRef = useRef<HTMLButtonElement>(null);
  const chevronMeasureRef = useRef<HTMLSpanElement>(null);
  const itemMeasureNodesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const lastViewportRef = useRef<HTMLSpanElement>(null);
  const lastTextRef = useRef<HTMLSpanElement>(null);

  const [fit, setFit] = useState<BreadcrumbFitResult>({ startIndex: 0, marqueeLast: false });
  const [marqueeShift, setMarqueeShift] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const measureFit = useCallback(() => {
    const trailEl = trailRef.current;
    if (!trailEl) {
      return;
    }
    const availableWidth = trailEl.clientWidth;
    if (availableWidth <= 0) {
      setFit((prev) =>
        prev.startIndex === 0 && !prev.marqueeLast ? prev : { startIndex: 0, marqueeLast: false },
      );
      return;
    }

    const styles = window.getComputedStyle(trailEl);
    const gap = parseFloat(styles.columnGap || styles.gap || '4') || 4;
    const chevronWidth = chevronMeasureRef.current?.getBoundingClientRect().width ?? 15;
    const separatorWidth = chevronWidth + gap * 2;
    const overflowWidth = overflowMeasureRef.current?.getBoundingClientRect().width ?? 32;
    const itemWidths = items.map(
      (_, index) => itemMeasureNodesRef.current[index]?.getBoundingClientRect().width ?? 0,
    );

    const next = computeVisibleBreadcrumbStart(
      itemWidths,
      availableWidth,
      separatorWidth,
      overflowWidth,
    );
    setFit((prev) =>
      prev.startIndex === next.startIndex && prev.marqueeLast === next.marqueeLast ? prev : next,
    );
  }, [items]);

  useLayoutEffect(() => {
    measureFit();
    const trailEl = trailRef.current;
    if (!trailEl) {
      return undefined;
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measureFit());
      observer.observe(trailEl);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measureFit);
    return () => window.removeEventListener('resize', measureFit);
  }, [measureFit]);

  useLayoutEffect(() => {
    if (!fit.marqueeLast) {
      return undefined;
    }
    const rafId = window.requestAnimationFrame(() => {
      const viewport = lastViewportRef.current;
      const text = lastTextRef.current;
      if (!viewport || !text) {
        setMarqueeShift(0);
        return;
      }
      const overflowPx = Math.max(0, Math.ceil(text.scrollWidth - viewport.clientWidth));
      setMarqueeShift(overflowPx > 2 ? overflowPx : 0);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [fit, items]);

  const effectiveMarqueeShift = fit.marqueeLast ? marqueeShift : 0;
  const clampedStart = Math.min(fit.startIndex, Math.max(0, items.length - 1));
  const hiddenItems = items.slice(0, clampedStart);
  const visibleItems = items.slice(clampedStart);
  const marqueeDurationSec = Math.max(4, Math.min(12, 3 + effectiveMarqueeShift / 28));

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
        sx={{
          width: '1px',
          height: '16px',
          backgroundColor: 'divider',
          mx: '2px',
          flexShrink: 0,
        }}
      />

      <BreadcrumbMeasureStrip aria-hidden="true">
        <BreadcrumbOverflowButton ref={overflowMeasureRef} type="button" tabIndex={-1}>
          <GoogleIcon name="expand_more" size={16} />
        </BreadcrumbOverflowButton>
        <span ref={chevronMeasureRef} style={{ display: 'inline-flex', flexShrink: 0 }}>
          <GoogleIcon name="chevron_right" size={15} />
        </span>
        {items.map((item, index) => (
          <BreadcrumbChip
            key={item.key}
            ref={(el) => {
              itemMeasureNodesRef.current[index] = el;
            }}
            type="button"
            active={index === items.length - 1}
            tabIndex={-1}
          >
            <GoogleIcon
              name={item.isRoot ? 'home' : 'folder'}
              size={15}
              filled={!item.isRoot && index === items.length - 1}
            />
            <span>{item.label}</span>
          </BreadcrumbChip>
        ))}
      </BreadcrumbMeasureStrip>

      <BreadcrumbTrail ref={trailRef} role="region" tabIndex={0} aria-label="文件夹路径层级">
        {hiddenItems.length > 0 && (
          <>
            <Tooltip title="展开隐藏路径" arrow>
              <BreadcrumbOverflowButton
                type="button"
                open={Boolean(menuAnchor)}
                aria-label="展开上级文件夹路径"
                aria-expanded={Boolean(menuAnchor)}
                aria-haspopup="menu"
                onClick={(event) => setMenuAnchor(event.currentTarget)}
              >
                <GoogleIcon name="expand_more" size={16} />
              </BreadcrumbOverflowButton>
            </Tooltip>
            <GoogleIcon name="chevron_right" size={15} style={{ opacity: 0.55, flexShrink: 0 }} />
          </>
        )}

        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const showChevron = index > 0;
          return (
            <React.Fragment key={item.key}>
              {showChevron && (
                <GoogleIcon
                  name="chevron_right"
                  size={15}
                  style={{ opacity: 0.55, flexShrink: 0 }}
                />
              )}
              {isLast ? (
                <Tooltip
                  title={item.label}
                  arrow
                  placement="top"
                  enterDelay={fit.marqueeLast ? 150 : 450}
                >
                  <span
                    className="breadcrumb-hover-wrap"
                    style={{
                      display: 'inline-flex',
                      minWidth: 0,
                      maxWidth: '100%',
                      flexShrink: fit.marqueeLast ? 1 : 0,
                    }}
                  >
                    <BreadcrumbChip type="button" active disabled allowShrink={fit.marqueeLast}>
                      <GoogleIcon
                        name="folder"
                        size={15}
                        filled
                        style={{ opacity: 0.85, flexShrink: 0 }}
                      />
                      <BreadcrumbMarqueeViewport
                        ref={lastViewportRef}
                        marquee={fit.marqueeLast && effectiveMarqueeShift > 0}
                      >
                        <BreadcrumbMarqueeText
                          ref={lastTextRef}
                          marqueeShift={effectiveMarqueeShift}
                          durationSec={marqueeDurationSec}
                        >
                          {item.label}
                        </BreadcrumbMarqueeText>
                      </BreadcrumbMarqueeViewport>
                    </BreadcrumbChip>
                  </span>
                </Tooltip>
              ) : (
                <BreadcrumbDropItem
                  folderId={item.folderId}
                  label={item.label}
                  icon={item.isRoot ? <GoogleIcon name="home" size={15} /> : undefined}
                  onNavigate={onNavigate}
                  onDropMaps={onDropMaps}
                />
              )}
            </React.Fragment>
          );
        })}
      </BreadcrumbTrail>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor) && hiddenItems.length > 0}
        onClose={() => setMenuAnchor(null)}
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
                maxWidth: '280px',
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
        {hiddenItems.map((item, idx) => (
          <MenuItem
            key={item.key}
            sx={{ pl: `${12 + Math.min(idx, 4) * 10}px` }}
            onClick={() => {
              setMenuAnchor(null);
              onNavigate(item.folderId);
            }}
          >
            <ListItemIcon sx={{ minWidth: 26 }}>
              <GoogleIcon name={item.isRoot ? 'home' : 'folder'} size={17} />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{
                primary: {
                  noWrap: true,
                  sx: { fontSize: '0.84rem', fontWeight: 500 },
                },
              }}
            />
          </MenuItem>
        ))}
      </Menu>
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
