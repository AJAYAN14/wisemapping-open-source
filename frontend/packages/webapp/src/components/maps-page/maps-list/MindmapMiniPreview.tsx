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

// Clean system-aligned branch colors matching prism-default / prism-dark on pure white/charcoal ground.
const BRANCH_PALETTE_LIGHT = [
  { fill: '#D1E7FF', stroke: '#007AFF', text: '#0040DD', line: '#007AFF' },
  { fill: '#DAF5E1', stroke: '#34C759', text: '#248A3D', line: '#34C759' },
  { fill: '#FFECCF', stroke: '#FF9500', text: '#C93400', line: '#FF9500' },
  { fill: '#DAF1F5', stroke: '#30B0C7', text: '#008299', line: '#30B0C7' },
  { fill: '#FFD9E0', stroke: '#FF2D55', text: '#D30F45', line: '#FF2D55' },
  { fill: '#E1E1F8', stroke: '#5856D6', text: '#3634A3', line: '#5856D6' },
] as const;

const BRANCH_PALETTE_DARK = [
  { fill: '#162840', stroke: '#409CFF', text: '#E5F0FF', line: '#0A84FF' },
  { fill: '#1A3524', stroke: '#30DB5B', text: '#DAF5E1', line: '#30D158' },
  { fill: '#3D2714', stroke: '#FFB340', text: '#FFECCF', line: '#FF9F0A' },
  { fill: '#1A333B', stroke: '#5DE6FF', text: '#DAF1F5', line: '#40C8E0' },
  { fill: '#3D1924', stroke: '#FF6482', text: '#FFD9E0', line: '#FF375F' },
  { fill: '#232244', stroke: '#7D7AFF', text: '#E1E1F8', line: '#5E5CE6' },
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
        fill={dark ? '#1C1C1E' : '#FFFFFF'}
      />

      {isEmpty ? (
        <>
          <path
            d={`M ${cx + centerW / 2} ${cy} C ${cx + 52} ${cy}, ${cx + 56} 54, 210 54`}
            fill="none"
            stroke={dark ? '#38383A' : '#D1D1D6'}
            strokeWidth="1.5"
          />
          <path
            d={`M ${cx + centerW / 2} ${cy} C ${cx + 52} ${cy}, ${cx + 56} 122, 210 122`}
            fill="none"
            stroke={dark ? '#38383A' : '#D1D1D6'}
            strokeWidth="1.5"
          />
          <path
            d={`M ${cx - centerW / 2} ${cy} C ${cx - 52} ${cy}, ${cx - 56} 88, 70 88`}
            fill="none"
            stroke={dark ? '#38383A' : '#D1D1D6'}
            strokeWidth="1.5"
          />
          <rect
            x="210"
            y="45"
            width="44"
            height="18"
            rx="5"
            fill={dark ? '#2C2C2E' : '#F2F2F7'}
            stroke={dark ? '#38383A' : '#E5E5EA'}
          />
          <rect
            x="210"
            y="113"
            width="44"
            height="18"
            rx="5"
            fill={dark ? '#2C2C2E' : '#F2F2F7'}
            stroke={dark ? '#38383A' : '#E5E5EA'}
          />
          <rect
            x="26"
            y="79"
            width="44"
            height="18"
            rx="5"
            fill={dark ? '#2C2C2E' : '#F2F2F7'}
            stroke={dark ? '#38383A' : '#E5E5EA'}
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
                  strokeWidth="0.9"
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
                  strokeWidth="0.9"
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
        rx="6"
        fill={dark ? '#0A84FF' : '#007AFF'}
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
