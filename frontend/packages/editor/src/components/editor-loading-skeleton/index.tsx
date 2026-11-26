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

import React from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import {
  AppBarDivider,
  AppBarIconSkeleton,
  AppBarLeft,
  AppBarLogoSkeleton,
  AppBarRight,
  AppBarSkeleton,
  AppBarTitleSkeleton,
  AppBarToolbar,
  BranchGroup,
  BranchSide,
  CanvasSkeleton,
  CentralNodeSkeleton,
  CompactOnlyGroup,
  ConnectorsSvg,
  DesktopOnlyGroup,
  DockButtonSkeleton,
  DockDivider,
  DockZoomPillSkeleton,
  LoadingContainer,
  MainNodeSkeleton,
  MindmapStage,
  SubNodeSkeleton,
  SubNodesColumn,
  ZoomToolbarSkeleton,
} from './styled';

/**
 * Loading skeleton that mirrors the Apple-design editor chrome (frosted AppBar,
 * Prism-tinted mindmap silhouette, and pill-shaped bottom visualization dock).
 */
const EditorLoadingSkeleton: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primaryBranchStroke = isDark ? 'rgba(64, 156, 255, 0.24)' : 'rgba(0, 122, 255, 0.18)';
  const secondaryBranchStroke = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.10)';

  return (
    <LoadingContainer aria-busy="true">
      {/* Floating Frosted Top AppBar */}
      <AppBarSkeleton>
        <AppBarToolbar>
          <AppBarLeft>
            <AppBarIconSkeleton animation="wave" variant="rounded" />
            <AppBarLogoSkeleton animation="wave" variant="rounded" />
            <AppBarTitleSkeleton animation="wave" variant="rounded" />
          </AppBarLeft>

          <Box sx={{ flexGrow: 1 }} />

          <AppBarRight>
            {/* Undo / Redo */}
            <AppBarIconSkeleton animation="wave" variant="rounded" />
            <AppBarIconSkeleton animation="wave" variant="rounded" />
            <AppBarDivider />

            {/* Save (+ History / Starred on md+) */}
            <AppBarIconSkeleton animation="wave" variant="rounded" />
            <DesktopOnlyGroup>
              <AppBarIconSkeleton animation="wave" variant="rounded" />
              <AppBarIconSkeleton animation="wave" variant="rounded" />
            </DesktopOnlyGroup>
            <AppBarDivider />

            {/* Find / Outline */}
            <AppBarIconSkeleton animation="wave" variant="rounded" />
            <AppBarIconSkeleton animation="wave" variant="rounded" />

            {/* Export / Theme on md+, or Overflow trigger on compact screens */}
            <DesktopOnlyGroup>
              <AppBarDivider />
              <AppBarIconSkeleton animation="wave" variant="rounded" />
              <AppBarIconSkeleton animation="wave" variant="rounded" />
            </DesktopOnlyGroup>
            <CompactOnlyGroup>
              <AppBarIconSkeleton animation="wave" variant="rounded" />
            </CompactOnlyGroup>
          </AppBarRight>
        </AppBarToolbar>
      </AppBarSkeleton>

      {/* Canvas Area with Prism Mindmap Silhouette */}
      <CanvasSkeleton>
        <MindmapStage>
          <ConnectorsSvg viewBox="-340 -120 680 240" aria-hidden="true">
            {/* Central -> Left Main Topics */}
            <path
              d="M -90 0 C -130 0, -135 -54, -172 -54"
              fill="none"
              stroke={primaryBranchStroke}
              strokeWidth="2"
            />
            <path
              d="M -90 0 C -130 0, -135 54, -172 54"
              fill="none"
              stroke={primaryBranchStroke}
              strokeWidth="2"
            />
            {/* Left Main -> SubTopics */}
            <path
              d="M -276 -54 C -292 -54, -296 -72, -312 -72"
              fill="none"
              stroke={secondaryBranchStroke}
              strokeWidth="1.5"
            />
            <path
              d="M -276 -54 C -292 -54, -296 -36, -312 -36"
              fill="none"
              stroke={secondaryBranchStroke}
              strokeWidth="1.5"
            />
            <path
              d="M -276 54 C -292 54, -296 54, -312 54"
              fill="none"
              stroke={secondaryBranchStroke}
              strokeWidth="1.5"
            />

            {/* Central -> Right Main Topics */}
            <path
              d="M 90 0 C 130 0, 135 -54, 172 -54"
              fill="none"
              stroke={primaryBranchStroke}
              strokeWidth="2"
            />
            <path
              d="M 90 0 C 130 0, 135 54, 172 54"
              fill="none"
              stroke={primaryBranchStroke}
              strokeWidth="2"
            />
            {/* Right Main -> SubTopics */}
            <path
              d="M 276 -54 C 292 -54, 296 -72, 312 -72"
              fill="none"
              stroke={secondaryBranchStroke}
              strokeWidth="1.5"
            />
            <path
              d="M 276 -54 C 292 -54, 296 -36, 312 -36"
              fill="none"
              stroke={secondaryBranchStroke}
              strokeWidth="1.5"
            />
            <path
              d="M 276 54 C 292 54, 296 54, 312 54"
              fill="none"
              stroke={secondaryBranchStroke}
              strokeWidth="1.5"
            />
          </ConnectorsSvg>

          {/* Left Branches */}
          <BranchSide sx={{ mr: '56px' }}>
            <BranchGroup>
              <SubNodesColumn>
                <SubNodeSkeleton animation="wave" variant="rounded" width={82} />
                <SubNodeSkeleton animation="wave" variant="rounded" width={72} />
              </SubNodesColumn>
              <MainNodeSkeleton animation="wave" variant="rounded" width={112} />
            </BranchGroup>
            <BranchGroup>
              <SubNodesColumn>
                <SubNodeSkeleton animation="wave" variant="rounded" width={88} />
              </SubNodesColumn>
              <MainNodeSkeleton animation="wave" variant="rounded" width={104} />
            </BranchGroup>
          </BranchSide>

          {/* Central Topic */}
          <CentralNodeSkeleton animation="wave" variant="rounded" />

          {/* Right Branches */}
          <BranchSide sx={{ ml: '56px' }}>
            <BranchGroup>
              <MainNodeSkeleton animation="wave" variant="rounded" width={116} />
              <SubNodesColumn>
                <SubNodeSkeleton animation="wave" variant="rounded" width={86} />
                <SubNodeSkeleton animation="wave" variant="rounded" width={70} />
              </SubNodesColumn>
            </BranchGroup>
            <BranchGroup>
              <MainNodeSkeleton animation="wave" variant="rounded" width={106} />
              <SubNodesColumn>
                <SubNodeSkeleton animation="wave" variant="rounded" width={84} />
              </SubNodesColumn>
            </BranchGroup>
          </BranchSide>
        </MindmapStage>
      </CanvasSkeleton>

      {/* Bottom Pill Visualization Dock Skeleton */}
      <ZoomToolbarSkeleton>
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockZoomPillSkeleton animation="wave" variant="rounded" />
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockDivider />
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockDivider />
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockButtonSkeleton animation="wave" variant="circular" />
        <DockDivider />
        <DockButtonSkeleton animation="wave" variant="circular" />
      </ZoomToolbarSkeleton>
    </LoadingContainer>
  );
};

export default EditorLoadingSkeleton;
