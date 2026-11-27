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
import React, { ReactElement } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';

import logoIcon from '../../../../images/logo-icon.svg';
import { DesktopDrawerToggle } from '../styled';
import StyleListItem from './filter-list-item';
import {
  DrawerContent,
  LogoIcon,
  LogoText,
  LogoBox,
  SectionHeader,
  UserAvatarBadge,
  UserAvatarImage,
  UserEmail,
  UserInfoBox,
  UserName,
} from './styled';
import type { AccountInfo } from '../../../classes/client';
import type { Filter, GenericFilter, LabelFilter } from '../index';
import { useIntl } from 'react-intl';

export interface ToolbarButtonInfo {
  filter: GenericFilter | LabelFilter;
  label: string;
  icon: React.ReactElement;
  count?: number | undefined;
  acceptDropToRoot?: boolean | undefined;
}

export interface DrawerNavProps {
  /** Account of the logged-in user, when already fetched. */
  account: AccountInfo | undefined;
  /** True when either the desktop or the mobile drawer is expanded. */
  drawerOpen: boolean;
  /** Filter entries to render, in order. */
  filterButtons: ToolbarButtonInfo[];
  /** Currently applied filter. */
  activeFilter: Filter;
  onFilterClick: (filter: Filter) => void;
  onLabelDelete: (id: number) => void;
  onToggleDesktopDrawer?: (() => void) | undefined;
  userMenu?: React.ReactNode;
}

/**
 * Contents shared by the maps page mobile and desktop drawers: product logo,
 * grouped filter navigation list, and the signed-in user's details.
 */
const DrawerNav = ({
  account,
  drawerOpen,
  filterButtons,
  activeFilter,
  onFilterClick,
  onLabelDelete,
  onToggleDesktopDrawer,
  userMenu,
}: DrawerNavProps): ReactElement => {
  const intl = useIntl();

  const primaryButtons = filterButtons.filter((b) => b.filter.type !== 'label');
  const labelButtons = filterButtons.filter((b) => b.filter.type === 'label');

  const [imgError, setImgError] = React.useState(false);
  const avatarUrl = account?.avatarUrl;

  const displayName =
    account?.fullName?.trim() ||
    [account?.firstname, account?.lastname].filter(Boolean).join(' ') ||
    account?.firstname ||
    account?.email;
  const initial = (displayName || 'W').trim().charAt(0).toUpperCase();

  return (
    <DrawerContent>
      <LogoBox
        key="logo"
        sx={!drawerOpen ? { padding: '14px 6px', justifyContent: 'center', gap: '2px' } : undefined}
      >
        <LogoIcon
          src={logoIcon}
          alt={intl.formatMessage({ id: 'common.logo', defaultMessage: 'WiseMapping logo' })}
          sx={!drawerOpen ? { height: '22px' } : undefined}
        />
        {drawerOpen && (
          <LogoText>
            <span className="logo-wise">wise</span>
            <span className="logo-mapping">mapping</span>
          </LogoText>
        )}
        {onToggleDesktopDrawer && (
          <DesktopDrawerToggle
            aria-label={intl.formatMessage({
              id: 'common.open-drawer',
              defaultMessage: 'Open drawer',
            })}
            onClick={onToggleDesktopDrawer}
            id="open-desktop-drawer"
            sx={
              drawerOpen
                ? { ml: 'auto', mr: 0 }
                : { width: '26px', height: '26px', mr: 0, ml: '2px' }
            }
          >
            {!drawerOpen && <NavigateNextRoundedIcon />}
            {drawerOpen && <NavigateBeforeRoundedIcon />}
          </DesktopDrawerToggle>
        )}
      </LogoBox>

      <List
        component="nav"
        sx={{
          paddingTop: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: '999px',
            backgroundColor: 'rgba(128, 128, 128, 0.28)',
          },
        }}
      >
        {drawerOpen && <SectionHeader>分类</SectionHeader>}
        {primaryButtons.map((buttonInfo) => (
          <StyleListItem
            icon={buttonInfo.icon}
            label={buttonInfo.label}
            filter={buttonInfo.filter}
            active={activeFilter}
            count={buttonInfo.count}
            onClick={onFilterClick}
            onDelete={onLabelDelete}
            key={`${buttonInfo.filter.type}:${buttonInfo.label}`}
          />
        ))}

        {labelButtons.length > 0 && drawerOpen && <SectionHeader sx={{ mt: 1 }}>标签</SectionHeader>}
        {labelButtons.map((buttonInfo) => (
          <StyleListItem
            icon={buttonInfo.icon}
            label={buttonInfo.label}
            filter={buttonInfo.filter}
            active={activeFilter}
            onClick={onFilterClick}
            onDelete={onLabelDelete}
            key={`${buttonInfo.filter.type}:${buttonInfo.label}`}
          />
        ))}
      </List>

      {userMenu !== undefined ? (
        userMenu
      ) : (
        account &&
        drawerOpen && (
          <UserInfoBox>
            {avatarUrl && !imgError ? (
              <UserAvatarImage
                src={avatarUrl}
                alt={displayName || account.email}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <UserAvatarBadge aria-hidden="true">{initial}</UserAvatarBadge>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <UserName variant="body2">{displayName}</UserName>
              <UserEmail variant="caption">{account.email}</UserEmail>
            </Box>
          </UserInfoBox>
        )
      )}
    </DrawerContent>
  );
};

export default DrawerNav;
