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

import React, { memo } from 'react';
import { useTheme } from '@mui/material/styles';
import type { MapPreview } from '../../../classes/client';
import { isDarkTheme } from '../appleDesign';

interface MindmapMiniPreviewProps {
  preview?: MapPreview | undefined;
  title: string;
}

// Restrained ink-on-paper branch palette (avoids saturated candy colors & AI violet).
const BRANCH_PALETTE_LIGHT = [
  { fill: '#F1F5F9', stroke: '#CBD5E1', text: '#334155', line: '#94A3B8' },
  { fill: '#FEF3C7', stroke: '#FCD34D', text: '#92400E', line: '#D97706' },
  { fill: '#ECFDF5', stroke: '#A7F3D0', text: '#065F46', line: '#10B981' },
  { fill: '#FFF7ED', stroke: '#FED7AA', text: '#9A3412', line: '#EA580C' },
  { fill: '#F0FDFA', stroke: '#99F6E4', text: '#115E59', line: '#14B8A6' },
  { fill: '#F4F4F5', stroke: '#D4D4D8', text: '#3F3F46', line: '#71717A' },
] as const;

const BRANCH_PALETTE_DARK = [
  { fill: 'rgba(148, 163, 184, 0.14)', stroke: 'rgba(148, 163, 184, 0.35)', text: '#E2E8F0', line: '#64748B' },
  { fill: 'rgba(245, 158, 11, 0.15)', stroke: 'rgba(251, 191, 36, 0.38)', text: '#FDE68A', line: '#F59E0B' },
  { fill: 'rgba(16, 185, 129, 0.14)', stroke: 'rgba(52, 211, 153, 0.35)', text: '#A7F3D0', line: '#34D399' },
  { fill: 'rgba(234, 88, 12, 0.15)', stroke: 'rgba(251, 146, 60, 0.35)', text: '#FED7AA', line: '#FB923C' },
  { fill: 'rgba(20, 184, 166, 0.14)', stroke: 'rgba(45, 212, 191, 0.35)', text: '#99F6E4', line: '#2DD4BF' },
  { fill: 'rgba(161, 161, 170, 0.15)', stroke: 'rgba(161, 161, 170, 0.35)', text: '#E4E4E7', line: '#A1A1AA' },
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
        fill={dark ? '#18181C' : '#FAFAFB'}
      />

      {isEmpty ? (
        <>
          <path
            d={`M ${cx + centerW / 2} ${cy} C ${cx + 52} ${cy}, ${cx + 56} 54, 210 54`}
            fill="none"
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}
            strokeWidth="1.5"
          />
          <path
            d={`M ${cx + centerW / 2} ${cy} C ${cx + 52} ${cy}, ${cx + 56} 122, 210 122`}
            fill="none"
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}
            strokeWidth="1.5"
          />
          <path
            d={`M ${cx - centerW / 2} ${cy} C ${cx - 52} ${cy}, ${cx - 56} 88, 70 88`}
            fill="none"
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}
            strokeWidth="1.5"
          />
          <rect
            x="210"
            y="45"
            width="44"
            height="18"
            rx="5"
            fill={dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'}
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#E4E4E7'}
          />
          <rect
            x="210"
            y="113"
            width="44"
            height="18"
            rx="5"
            fill={dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'}
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#E4E4E7'}
          />
          <rect
            x="26"
            y="79"
            width="44"
            height="18"
            rx="5"
            fill={dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'}
            stroke={dark ? 'rgba(255,255,255,0.14)' : '#E4E4E7'}
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
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <rect
                  x={targetX}
                  y={y - 9}
                  width={nodeW}
                  height="18"
                  rx="5"
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1"
                />
                <text
                  x={targetX + nodeW / 2}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="500"
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
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <rect
                  x={targetX - nodeW}
                  y={y - 9}
                  width={nodeW}
                  height="18"
                  rx="5"
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1"
                />
                <text
                  x={targetX - nodeW / 2}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="500"
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
        rx="6"
        fill={dark ? '#27272A' : '#18181B'}
        stroke={dark ? 'rgba(255,255,255,0.16)' : 'none'}
      />
      <text
        x={cx}
        y={cy + 3.5}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="#FFFFFF"
      >
        {centralLabel}
      </text>
    </svg>
  );
};

export const MindmapMiniPreview = memo(MindmapMiniPreviewComponent);
