import React, { memo } from 'react';
import { useTheme } from '@mui/material/styles';
import type { MapPreview } from '../../../classes/client';
import { isDarkTheme } from '../appleDesign';

interface MindmapMiniPreviewProps {
  preview?: MapPreview | undefined;
  title: string;
}

const BRANCH_PALETTE_LIGHT = [
  { fill: '#E0F2FE', stroke: '#7DD3FC', text: '#0369A1', line: '#38BDF8' },
  { fill: '#FEF3C7', stroke: '#FCD34D', text: '#B45309', line: '#F59E0B' },
  { fill: '#DCFCE7', stroke: '#86EFAC', text: '#15803D', line: '#22C55E' },
  { fill: '#FCE7F3', stroke: '#F9A8D4', text: '#BE185D', line: '#EC4899' },
  { fill: '#EDE9FE', stroke: '#C4B5FD', text: '#6D28D9', line: '#8B5CF6' },
  { fill: '#FFEDD5', stroke: '#FDBA74', text: '#C2410C', line: '#F97316' },
] as const;

const BRANCH_PALETTE_DARK = [
  { fill: 'rgba(14, 165, 233, 0.18)', stroke: 'rgba(56, 189, 248, 0.45)', text: '#BAE6FD', line: '#38BDF8' },
  { fill: 'rgba(245, 158, 11, 0.18)', stroke: 'rgba(251, 191, 36, 0.45)', text: '#FDE68A', line: '#FBBF24' },
  { fill: 'rgba(34, 197, 94, 0.18)', stroke: 'rgba(74, 222, 128, 0.45)', text: '#BBF7D0', line: '#4ADE80' },
  { fill: 'rgba(236, 72, 153, 0.18)', stroke: 'rgba(244, 114, 182, 0.45)', text: '#FBCFE8', line: '#F472B6' },
  { fill: 'rgba(139, 92, 246, 0.18)', stroke: 'rgba(167, 139, 250, 0.45)', text: '#DDD6FE', line: '#A78BFA' },
  { fill: 'rgba(249, 115, 22, 0.18)', stroke: 'rgba(251, 146, 60, 0.45)', text: '#FED7AA', line: '#FB923C' },
] as const;

const clipText = (text: string, maxChars: number): string =>
  text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;

const MindmapMiniPreviewComponent = ({ preview, title }: MindmapMiniPreviewProps): React.ReactElement => {
  const theme = useTheme();
  const dark = isDarkTheme(theme);
  const palette = dark ? BRANCH_PALETTE_DARK : BRANCH_PALETTE_LIGHT;

  const centralLabel = clipText(preview?.centralTopic || title || '中心主题', 12);
  const rawBranches = preview?.branches ?? [];

  const leftBranches: Array<{ text: string; idx: number }> = [];
  const rightBranches: Array<{ text: string; idx: number }> = [];

  rawBranches.slice(0, 6).forEach((branch, idx) => {
    const entry = { text: clipText(branch.text || '分支', 9), idx };
    if (branch.side === 'left') {
      leftBranches.push(entry);
    } else if (branch.side === 'right') {
      rightBranches.push(entry);
    } else if (rightBranches.length <= leftBranches.length) {
      rightBranches.push(entry);
    } else {
      leftBranches.push(entry);
    }
  });

  const isEmpty = leftBranches.length === 0 && rightBranches.length === 0;
  const cx = 140;
  const cy = 88;
  const centerW = Math.min(106, Math.max(66, centralLabel.length * 8.2 + 22));
  const centerH = 26;

  const computeYSlots = (count: number): number[] => {
    if (count <= 0) return [];
    if (count === 1) return [cy];
    if (count === 2) return [cy - 30, cy + 30];
    if (count === 3) return [cy - 44, cy, cy + 44];
    const span = 114;
    const step = span / (count - 1);
    return Array.from({ length: count }, (_, i) => cy - span / 2 + i * step);
  };

  const leftYs = computeYSlots(leftBranches.length);
  const rightYs = computeYSlots(rightBranches.length);

  return (
    <svg
      viewBox="0 0 280 176"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <rect
        x="0"
        y="0"
        width="280"
        height="176"
        fill={dark ? '#18181B' : '#F8FAFC'}
      />

      {isEmpty ? (
        <>
          <path
            d={`M ${cx + centerW / 2} ${cy} C ${cx + 52} ${cy}, ${cx + 56} 54, 210 54`}
            fill="none"
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}
            strokeWidth="1.6"
          />
          <path
            d={`M ${cx + centerW / 2} ${cy} C ${cx + 52} ${cy}, ${cx + 56} 122, 210 122`}
            fill="none"
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}
            strokeWidth="1.6"
          />
          <path
            d={`M ${cx - centerW / 2} ${cy} C ${cx - 52} ${cy}, ${cx - 56} 88, 70 88`}
            fill="none"
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}
            strokeWidth="1.6"
          />
          <rect
            x="210"
            y="45"
            width="44"
            height="18"
            rx="6"
            fill={dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'}
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#E2E8F0'}
          />
          <rect
            x="210"
            y="113"
            width="44"
            height="18"
            rx="6"
            fill={dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'}
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#E2E8F0'}
          />
          <rect
            x="26"
            y="79"
            width="44"
            height="18"
            rx="6"
            fill={dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'}
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#E2E8F0'}
          />
        </>
      ) : (
        <>
          {rightBranches.map((branch, i) => {
            const y = rightYs[i] ?? cy;
            const style = palette[branch.idx % palette.length]!;
            const startX = cx + centerW / 2;
            const targetX = 198;
            const nodeW = Math.min(68, Math.max(38, branch.text.length * 6.8 + 14));
            return (
              <g key={`r-${branch.idx}`}>
                <path
                  d={`M ${startX} ${cy} C ${startX + 20} ${cy}, ${targetX - 20} ${y}, ${targetX} ${y}`}
                  fill="none"
                  stroke={style.line}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <rect
                  x={targetX}
                  y={y - 9}
                  width={nodeW}
                  height="18"
                  rx="6"
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1"
                />
                <text
                  x={targetX + nodeW / 2}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="600"
                  fill={style.text}
                >
                  {branch.text}
                </text>
              </g>
            );
          })}

          {leftBranches.map((branch, i) => {
            const y = leftYs[i] ?? cy;
            const style = palette[branch.idx % palette.length]!;
            const startX = cx - centerW / 2;
            const targetX = 82;
            const nodeW = Math.min(68, Math.max(38, branch.text.length * 6.8 + 14));
            return (
              <g key={`l-${branch.idx}`}>
                <path
                  d={`M ${startX} ${cy} C ${startX - 20} ${cy}, ${targetX + 20} ${y}, ${targetX} ${y}`}
                  fill="none"
                  stroke={style.line}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <rect
                  x={targetX - nodeW}
                  y={y - 9}
                  width={nodeW}
                  height="18"
                  rx="6"
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1"
                />
                <text
                  x={targetX - nodeW / 2}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="600"
                  fill={style.text}
                >
                  {branch.text}
                </text>
              </g>
            );
          })}
        </>
      )}

      {/* Central Node */}
      <rect
        x={cx - centerW / 2}
        y={cy - centerH / 2}
        width={centerW}
        height={centerH}
        rx="8"
        fill={dark ? '#0284C7' : '#0284C7'}
      />
      <text
        x={cx}
        y={cy + 3.5}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#FFFFFF"
      >
        {centralLabel}
      </text>
    </svg>
  );
};

export const MindmapMiniPreview = memo(MindmapMiniPreviewComponent);
