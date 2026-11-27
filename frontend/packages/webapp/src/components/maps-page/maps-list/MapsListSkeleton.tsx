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
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { readStorage } from '../../../utils/storage';
import { RADIUS_MD } from '../appleDesign';
import { BodyCell, CompactCardHeader, MapCardRoot } from './shared.styled';
import {
  DrawerSkeleton,
  LoadingContainer,
  LoadingDrawer,
  LoadingDrawerFooter,
  LoadingDrawerItem,
  LoadingDrawerList,
  LoadingDrawerLogo,
  LoadingDrawerQuickGrid,
  LoadingDrawerQuickPill,
  LoadingDrawerSectionHeader,
  LoadingDrawerUserCard,
  LoadingGrid,
  LoadingGridCard,
  LoadingGridPreview,
  LoadingHeaderCell,
  LoadingListPaper,
  LoadingMainContent,
  LoadingSearchBox,
  LoadingSearchCluster,
  LoadingSearchToolbar,
  LoadingSegmentedGroup,
  LoadingSegmentedTab,
  LoadingTableContainer,
  LoadingToolbarPill,
  SkeletonAmberBlock,
  SkeletonBlock,
  SkeletonText,
} from './skeleton.styled';

const ROW_TITLE_WIDTHS = ['56%', '44%', '66%', '50%', '62%'] as const;
const ROW_HAS_LABEL = [true, false, true, false, true] as const;

export const TableRowSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => {
  const titleWidth = ROW_TITLE_WIDTHS[index % ROW_TITLE_WIDTHS.length];
  const hasLabel = ROW_HAS_LABEL[index % ROW_HAS_LABEL.length];

  return (
    <TableRow hover>
      <BodyCell padding="checkbox">
        <SkeletonBlock animation="pulse" variant="rounded" width={18} height={18} />
      </BodyCell>
      <BodyCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SkeletonAmberBlock
            animation="pulse"
            variant="rounded"
            width={30}
            height={30}
            sx={{ borderRadius: RADIUS_MD, flexShrink: 0 }}
          />
          <SkeletonText animation="pulse" variant="text" width={titleWidth} />
        </Box>
      </BodyCell>
      <BodyCell sx={{ textAlign: 'right' }}>
        {hasLabel ? (
          <Box sx={{ display: 'inline-flex', justifyContent: 'flex-end', gap: '6px' }}>
            <SkeletonBlock
              animation="pulse"
              variant="rounded"
              width={54}
              height={20}
              sx={{ borderRadius: '999px' }}
            />
          </Box>
        ) : null}
      </BodyCell>
      <BodyCell>
        <SkeletonText animation="pulse" variant="text" width={52} />
      </BodyCell>
      <BodyCell>
        <SkeletonText animation="pulse" variant="text" width={68} />
      </BodyCell>
      <BodyCell padding="checkbox">
        <SkeletonBlock animation="pulse" variant="circular" width={22} height={22} />
      </BodyCell>
      <BodyCell>
        <SkeletonBlock animation="pulse" variant="circular" width={22} height={22} />
      </BodyCell>
    </TableRow>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <MapCardRoot elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ pl: 1.5, pr: 0.5, flexShrink: 0 }}>
          <SkeletonBlock animation="pulse" variant="rounded" width={18} height={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CompactCardHeader
            avatar={<SkeletonBlock animation="pulse" variant="circular" width={22} height={22} />}
            action={<SkeletonBlock animation="pulse" variant="circular" width={22} height={22} />}
            title={<SkeletonText animation="pulse" variant="text" width="70%" />}
            subheader={<SkeletonText animation="pulse" variant="text" width="46%" />}
          />
        </Box>
      </Box>
    </MapCardRoot>
  );
};

export const GridCardSkeleton: React.FC = () => {
  return (
    <LoadingGridCard>
      <LoadingGridPreview>
        <SkeletonBlock
          animation="pulse"
          variant="rectangular"
          width="100%"
          height="100%"
        />
      </LoadingGridPreview>
      <Box sx={{ p: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <SkeletonText animation="pulse" variant="text" width="74%" height={20} />
        <SkeletonText animation="pulse" variant="text" width="46%" height={15} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '8px', mt: '2px' }}>
          <SkeletonText animation="pulse" variant="text" width="38%" height={16} />
          <SkeletonText animation="pulse" variant="text" width="22%" height={16} />
        </Box>
      </Box>
    </LoadingGridCard>
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
  const storedViewMode = readStorage('mapsListViewMode') === 'grid' ? 'grid' : 'list';

  return (
    <LoadingContainer aria-busy="true">
      {/* Left Drawer Skeleton — matches collapsed (64px) or expanded (236px) user preference */}
      <LoadingDrawer expanded={drawerExpanded}>
        <LoadingDrawerLogo expanded={drawerExpanded}>
          <DrawerSkeleton
            animation="pulse"
            variant="rounded"
            width={24}
            height={24}
            sx={{ borderRadius: '6px', flexShrink: 0 }}
          />
          {drawerExpanded && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <DrawerSkeleton animation="pulse" variant="text" width={40} height={13} />
              <DrawerSkeleton animation="pulse" variant="text" width={72} height={14} />
            </Box>
          )}
        </LoadingDrawerLogo>

        <LoadingDrawerList>
          {drawerExpanded && (
            <LoadingDrawerSectionHeader>
              <DrawerSkeleton animation="pulse" variant="text" width={28} height={13} />
            </LoadingDrawerSectionHeader>
          )}
          {[76, 62].map((labelWidth, index) => (
            <LoadingDrawerItem
              // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed-length navigation placeholders
              key={index}
              expanded={drawerExpanded}
              selected={index === 0}
            >
              <DrawerSkeleton
                animation="pulse"
                variant="rounded"
                width={18}
                height={18}
                sx={{ borderRadius: '5px', flexShrink: 0 }}
              />
              {drawerExpanded && (
                <DrawerSkeleton animation="pulse" variant="text" width={labelWidth} height={17} />
              )}
            </LoadingDrawerItem>
          ))}
        </LoadingDrawerList>

        <LoadingDrawerFooter expanded={drawerExpanded}>
          {drawerExpanded ? (
            <>
              <LoadingDrawerQuickGrid>
                <LoadingDrawerQuickPill>
                  <DrawerSkeleton animation="pulse" variant="circular" width={16} height={16} />
                  <DrawerSkeleton animation="pulse" variant="text" width={44} height={14} />
                </LoadingDrawerQuickPill>
                <LoadingDrawerQuickPill>
                  <DrawerSkeleton animation="pulse" variant="circular" width={16} height={16} />
                  <DrawerSkeleton animation="pulse" variant="text" width={44} height={14} />
                </LoadingDrawerQuickPill>
              </LoadingDrawerQuickGrid>
              <LoadingDrawerUserCard>
                <DrawerSkeleton
                  animation="pulse"
                  variant="circular"
                  width={28}
                  height={28}
                  sx={{ flexShrink: 0 }}
                />
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}
                >
                  <DrawerSkeleton animation="pulse" variant="text" width="62%" height={15} />
                  <DrawerSkeleton animation="pulse" variant="text" width="84%" height={12} />
                </Box>
              </LoadingDrawerUserCard>
            </>
          ) : (
            <>
              <DrawerSkeleton
                animation="pulse"
                variant="rounded"
                width={36}
                height={36}
                sx={{ borderRadius: RADIUS_MD }}
              />
              <DrawerSkeleton
                animation="pulse"
                variant="rounded"
                width={36}
                height={36}
                sx={{ borderRadius: RADIUS_MD }}
              />
              <DrawerSkeleton animation="pulse" variant="circular" width={30} height={30} />
            </>
          )}
        </LoadingDrawerFooter>
      </LoadingDrawer>

      {/* Main Content Area */}
      <LoadingMainContent>
        <Box
          component="header"
          sx={{
            width: '100%',
            padding: '10px 12px 0 12px',
            display: { xs: 'flex', sm: 'none' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            minHeight: '40px',
            boxSizing: 'border-box',
          }}
        >
          <SkeletonBlock
            animation="pulse"
            variant="rounded"
            width={36}
            height={36}
            sx={{ borderRadius: RADIUS_MD, flexShrink: 0 }}
          />
        </Box>

        {/* Maps List Area */}
        <LoadingListPaper elevation={0}>
          {/* Toolbar Skeleton matching Segmented Tabs + Search + CTA + View Toggle + Sort */}
          <LoadingSearchToolbar variant="dense">
            <LoadingSegmentedGroup>
              <LoadingSegmentedTab active>
                <SkeletonBlock animation="pulse" variant="rounded" width={16} height={16} />
                <SkeletonBlock animation="pulse" variant="text" width={54} height={16} />
                <SkeletonBlock
                  animation="pulse"
                  variant="rounded"
                  width={20}
                  height={16}
                  sx={{ borderRadius: '999px' }}
                />
              </LoadingSegmentedTab>
              <LoadingSegmentedTab>
                <SkeletonBlock animation="pulse" variant="rounded" width={16} height={16} />
                <SkeletonBlock animation="pulse" variant="text" width={42} height={16} />
                <SkeletonBlock
                  animation="pulse"
                  variant="rounded"
                  width={20}
                  height={16}
                  sx={{ borderRadius: '999px' }}
                />
              </LoadingSegmentedTab>
            </LoadingSegmentedGroup>

            <LoadingSearchCluster>
              <LoadingSearchBox>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <SkeletonBlock animation="pulse" variant="circular" width={15} height={15} />
                  <SkeletonBlock animation="pulse" variant="text" width="58%" height={15} />
                </Box>
                {!isMobile && (
                  <SkeletonBlock
                    animation="pulse"
                    variant="rounded"
                    width={26}
                    height={17}
                    sx={{ borderRadius: '6px', flexShrink: 0 }}
                  />
                )}
              </LoadingSearchBox>

              {!isMobile && (
                <>
                  <SkeletonBlock
                    animation="pulse"
                    variant="rounded"
                    width={84}
                    height={34}
                    sx={{ borderRadius: RADIUS_MD, flexShrink: 0 }}
                  />
                  <LoadingSegmentedGroup>
                    <SkeletonBlock
                      animation="pulse"
                      variant="rounded"
                      width={28}
                      height={26}
                      sx={{ borderRadius: '6px' }}
                    />
                    <SkeletonBlock
                      animation="pulse"
                      variant="rounded"
                      width={28}
                      height={26}
                      sx={{ borderRadius: '6px' }}
                    />
                  </LoadingSegmentedGroup>
                  <LoadingToolbarPill>
                    <SkeletonBlock animation="pulse" variant="circular" width={15} height={15} />
                    <SkeletonBlock animation="pulse" variant="text" width={44} height={15} />
                  </LoadingToolbarPill>
                </>
              )}
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
          ) : storedViewMode === 'grid' ? (
            <LoadingGrid>
              {Array.from({ length: 8 }).map((_, index) => (
                <GridCardSkeleton
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- identical placeholders
                  key={index}
                />
              ))}
            </LoadingGrid>
          ) : (
            <LoadingTableContainer>
              <Table size="small" sx={{ minWidth: 680, backgroundColor: 'transparent' }}>
                <TableHead>
                  <TableRow>
                    <LoadingHeaderCell padding="checkbox" sx={{ width: '20px' }}>
                      <SkeletonBlock animation="pulse" variant="rounded" width={18} height={18} />
                    </LoadingHeaderCell>
                    <LoadingHeaderCell>
                      <SkeletonText animation="pulse" variant="text" width={52} />
                    </LoadingHeaderCell>
                    <LoadingHeaderCell />
                    <LoadingHeaderCell sx={{ width: '96px' }}>
                      <SkeletonText animation="pulse" variant="text" width={36} />
                    </LoadingHeaderCell>
                    <LoadingHeaderCell sx={{ width: '120px' }}>
                      <SkeletonText animation="pulse" variant="text" width={68} />
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
