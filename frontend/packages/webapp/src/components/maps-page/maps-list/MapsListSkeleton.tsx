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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { readStorage } from '../../../utils/storage';
import { BodyCell, CompactCardHeader, MapCardRoot } from './shared.styled';
import {
  DrawerSkeleton,
  LoadingAppBar,
  LoadingContainer,
  LoadingDrawer,
  LoadingDrawerItem,
  LoadingDrawerList,
  LoadingDrawerLogo,
  LoadingDrawerSectionHeader,
  LoadingDrawerUserCard,
  LoadingHeaderCell,
  LoadingHeadingCluster,
  LoadingListPaper,
  LoadingMainContent,
  LoadingSearchBox,
  LoadingSearchCluster,
  LoadingSearchToolbar,
  LoadingTableContainer,
  LoadingToolbarSpacer,
  SkeletonAmberBlock,
  SkeletonBlock,
  SkeletonButton,
  SkeletonText,
} from './skeleton.styled';

const ROW_TITLE_WIDTHS = ['58%', '46%', '68%', '52%', '64%'] as const;
const ROW_HAS_LABEL = [true, false, true, false, true] as const;

export const TableRowSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => {
  const titleWidth = ROW_TITLE_WIDTHS[index % ROW_TITLE_WIDTHS.length];
  const hasLabel = ROW_HAS_LABEL[index % ROW_HAS_LABEL.length];

  return (
    <TableRow hover>
      <BodyCell padding="checkbox">
        <SkeletonBlock animation="wave" variant="rounded" width={18} height={18} />
      </BodyCell>
      <BodyCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SkeletonAmberBlock
            animation="wave"
            variant="rounded"
            width={32}
            height={32}
            sx={{ borderRadius: '10px', flexShrink: 0 }}
          />
          <SkeletonText animation="wave" variant="text" width={titleWidth} />
        </Box>
      </BodyCell>
      <BodyCell sx={{ textAlign: 'right' }}>
        {hasLabel ? (
          <Box sx={{ display: 'inline-flex', justifyContent: 'flex-end', gap: '6px' }}>
            <SkeletonBlock
              animation="wave"
              variant="rounded"
              width={56}
              height={22}
              sx={{ borderRadius: '999px' }}
            />
          </Box>
        ) : null}
      </BodyCell>
      <BodyCell>
        <SkeletonText animation="wave" variant="text" width={72} />
      </BodyCell>
      <BodyCell padding="checkbox">
        <SkeletonBlock animation="wave" variant="circular" width={24} height={24} />
      </BodyCell>
      <BodyCell>
        <SkeletonBlock animation="wave" variant="circular" width={24} height={24} />
      </BodyCell>
    </TableRow>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <MapCardRoot elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ pl: 1.5, pr: 0.5, flexShrink: 0 }}>
          <SkeletonBlock animation="wave" variant="rounded" width={18} height={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CompactCardHeader
            avatar={<SkeletonBlock animation="wave" variant="circular" width={24} height={24} />}
            action={<SkeletonBlock animation="wave" variant="circular" width={24} height={24} />}
            title={<SkeletonText animation="wave" variant="text" width="70%" />}
            subheader={<SkeletonText animation="wave" variant="text" width="48%" />}
          />
        </Box>
      </Box>
    </MapCardRoot>
  );
};

export const MapsListSkeleton: React.FC<{ rowsPerPage: number }> = ({ rowsPerPage }) => {
  const skeletonCount = Math.min(rowsPerPage, 5); // Show max 5 skeleton rows

  return (
    <>
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <TableRowSkeleton
          // eslint-disable-next-line @eslint-react/no-array-index-key -- identical placeholders in a fixed-length list that never reorders
          key={index}
          index={index}
        />
      ))}
    </>
  );
};

const narrowScreen = (theme: Theme): string => theme.breakpoints.down('sm');

export const MapsPageLoading = (): React.ReactElement => {
  const isMobile = useMediaQuery(narrowScreen, { noSsr: true });
  const drawerExpanded = readStorage('desktopDrawerOpen') === 'true';

  return (
    <LoadingContainer aria-busy="true">
      {/* Left Drawer Skeleton — matches collapsed (68px) or expanded (240px) user preference */}
      <LoadingDrawer expanded={drawerExpanded}>
        <LoadingDrawerLogo expanded={drawerExpanded}>
          <DrawerSkeleton
            animation="wave"
            variant="rounded"
            width={28}
            height={28}
            sx={{ borderRadius: '8px', flexShrink: 0 }}
          />
          {drawerExpanded && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <DrawerSkeleton animation="wave" variant="text" width={42} height={14} />
              <DrawerSkeleton animation="wave" variant="text" width={78} height={15} />
            </Box>
          )}
        </LoadingDrawerLogo>

        <LoadingDrawerList>
          {drawerExpanded && (
            <LoadingDrawerSectionHeader>
              <DrawerSkeleton animation="wave" variant="text" width={28} height={14} />
            </LoadingDrawerSectionHeader>
          )}
          {[88, 64, 72].map((labelWidth, index) => (
            <LoadingDrawerItem
              // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-length navigation placeholders
              key={index}
              expanded={drawerExpanded}
              selected={index === 0}
            >
              <DrawerSkeleton
                animation="wave"
                variant="rounded"
                width={20}
                height={20}
                sx={{ borderRadius: '6px', flexShrink: 0 }}
              />
              {drawerExpanded && (
                <DrawerSkeleton animation="wave" variant="text" width={labelWidth} height={18} />
              )}
            </LoadingDrawerItem>
          ))}

          {drawerExpanded && (
            <LoadingDrawerSectionHeader sx={{ mt: 1 }}>
              <DrawerSkeleton animation="wave" variant="text" width={38} height={14} />
              <DrawerSkeleton
                animation="wave"
                variant="rounded"
                width={18}
                height={18}
                sx={{ borderRadius: '6px' }}
              />
            </LoadingDrawerSectionHeader>
          )}
          {[96, 78].map((folderWidth, index) => (
            <LoadingDrawerItem
              // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-length folder placeholders
              key={`folder-${index}`}
              expanded={drawerExpanded}
            >
              <DrawerSkeleton
                animation="wave"
                variant="rounded"
                width={20}
                height={20}
                sx={{ borderRadius: '6px', flexShrink: 0 }}
              />
              {drawerExpanded && (
                <>
                  <DrawerSkeleton animation="wave" variant="text" width={folderWidth} height={17} />
                  <DrawerSkeleton
                    animation="wave"
                    variant="rounded"
                    width={22}
                    height={16}
                    sx={{ ml: 'auto', borderRadius: '999px' }}
                  />
                </>
              )}
            </LoadingDrawerItem>
          ))}
        </LoadingDrawerList>

        {drawerExpanded && (
          <LoadingDrawerUserCard>
            <SkeletonAmberBlock
              animation="wave"
              variant="circular"
              width={30}
              height={30}
              sx={{ flexShrink: 0 }}
            />
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}
            >
              <DrawerSkeleton animation="wave" variant="text" width="65%" height={16} />
              <DrawerSkeleton animation="wave" variant="text" width="88%" height={13} />
            </Box>
          </LoadingDrawerUserCard>
        )}
      </LoadingDrawer>

      {/* Main Content Area */}
      <LoadingMainContent>
        {/* Frosted AppBar Skeleton */}
        <LoadingAppBar position="fixed" elevation={0} expanded={drawerExpanded}>
          <Toolbar>
            <SkeletonBlock
              animation="wave"
              variant="rounded"
              width={isMobile ? 38 : 34}
              height={isMobile ? 38 : 34}
              sx={{ borderRadius: '10px', mr: '6px', flexShrink: 0 }}
            />
            <SkeletonAmberBlock
              animation="wave"
              variant="rounded"
              width={isMobile ? 38 : 104}
              height={isMobile ? 38 : 36}
              sx={{ borderRadius: isMobile ? '10px' : '12px', flexShrink: 0 }}
            />
            <SkeletonButton
              animation="wave"
              variant="rounded"
              width={isMobile ? 38 : 102}
              height={isMobile ? 38 : 36}
              sx={{ borderRadius: isMobile ? '10px' : '12px', flexShrink: 0 }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <SkeletonBlock
              animation="wave"
              variant="rounded"
              width={34}
              height={34}
              sx={{ borderRadius: '10px', flexShrink: 0 }}
            />
            <SkeletonBlock
              animation="wave"
              variant="circular"
              width={34}
              height={34}
              sx={{ flexShrink: 0 }}
            />
          </Toolbar>
        </LoadingAppBar>

        <LoadingToolbarSpacer />

        {/* Maps List Area */}
        <LoadingListPaper elevation={0}>
          {/* Workspace Heading + Spotlight Search Skeleton */}
          <LoadingSearchToolbar variant="dense">
            <LoadingHeadingCluster>
              <SkeletonBlock
                animation="wave"
                variant="rounded"
                width={84}
                height={28}
                sx={{ borderRadius: '8px' }}
              />
              <SkeletonBlock
                animation="wave"
                variant="rounded"
                width={32}
                height={22}
                sx={{ borderRadius: '999px' }}
              />
            </LoadingHeadingCluster>

            <LoadingSearchCluster>
              <LoadingSearchBox>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <SkeletonBlock animation="wave" variant="circular" width={16} height={16} />
                  <SkeletonBlock animation="wave" variant="text" width="60%" height={16} />
                </Box>
                {!isMobile && (
                  <SkeletonBlock
                    animation="wave"
                    variant="rounded"
                    width={26}
                    height={18}
                    sx={{ borderRadius: '6px', flexShrink: 0 }}
                  />
                )}
              </LoadingSearchBox>
            </LoadingSearchCluster>
          </LoadingSearchToolbar>

          {isMobile ? (
            <Box>
              {Array.from({ length: 5 }).map((_, index) => (
                <CardSkeleton
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- identical placeholders
                  key={index}
                />
              ))}
            </Box>
          ) : (
            <LoadingTableContainer>
              <Table size="small" sx={{ minWidth: 680, backgroundColor: 'transparent' }}>
                <TableHead>
                  <TableRow>
                    <LoadingHeaderCell padding="checkbox" sx={{ width: '20px' }}>
                      <SkeletonBlock animation="wave" variant="rounded" width={18} height={18} />
                    </LoadingHeaderCell>
                    <LoadingHeaderCell>
                      <SkeletonText animation="wave" variant="text" width={52} />
                    </LoadingHeaderCell>
                    <LoadingHeaderCell />
                    <LoadingHeaderCell sx={{ width: '120px' }}>
                      <SkeletonText animation="wave" variant="text" width={68} />
                    </LoadingHeaderCell>
                    <LoadingHeaderCell padding="checkbox" />
                    <LoadingHeaderCell padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  <MapsListSkeleton rowsPerPage={10} />
                </TableBody>
              </Table>
            </LoadingTableContainer>
          )}
        </LoadingListPaper>
      </LoadingMainContent>
    </LoadingContainer>
  );
};
