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

import { useQueryClient } from '@tanstack/react-query';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import React, { use } from 'react';
import { FormattedMessage } from 'react-intl';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import { useFetchAccount } from '../../../classes/middleware';
import { ClientContext } from '../../../classes/provider/client-context';
import JwtTokenConfig from '../../../classes/jwt-token-config';
import { appleColors, applePressMixin, isDarkTheme } from '../appleDesign';
import StorageQuotaDialog from './StorageQuotaDialog';

declare const VITE_APP_VERSION: string | undefined;
declare const VITE_BUILD_TIME: string | undefined;

const APP_VERSION = typeof VITE_APP_VERSION !== 'undefined' ? VITE_APP_VERSION : '6.0.4';
const BUILD_TIME = typeof VITE_BUILD_TIME !== 'undefined' ? VITE_BUILD_TIME : '';

const VersionBadge = styled('span')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontSize: '11px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.01em',
    color: c.textSecondary,
    backgroundColor: c.hoverFill,
    border: `1px solid ${c.hairline}`,
    borderRadius: '999px',
    padding: '2px 7px',
    lineHeight: 1.4,
    userSelect: 'none',
    cursor: 'pointer',
  };
});

const AvatarTrigger = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    padding: '3px',
    borderRadius: '999px',
    border: `1px solid ${c.hairline}`,
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.hoverFill,
      borderColor: c.hairlineStrong,
    },
  };
});

const AvatarImage = styled('img')({
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  objectFit: 'cover',
  display: 'block',
});

const AvatarCircle = styled('span')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    backgroundColor: c.amberSoft,
    color: c.amberText,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1,
  };
});

const AccountMenu = (): React.ReactElement => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement>();
  const [storageOpen, setStorageOpen] = React.useState(false);
  const open = Boolean(anchorEl);
  const client = use(ClientContext);
  const queryClient = useQueryClient();

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  const handleLogout = async (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    handleClose();

    JwtTokenConfig.removeToken();
    await client.logout();
    queryClient.removeQueries({ queryKey: ['account'] });
    window.location.href = '/c/login';
  };

  const account = useFetchAccount();
  const email = account?.email || 'a.jian0629@gmail.com';
  const fullName =
    account?.fullName ||
    [account?.firstname, account?.lastname].filter(Boolean).join(' ') ||
    account?.firstname;
  const initial = (fullName || email).trim().charAt(0).toUpperCase();
  const avatarUrl = account?.avatarUrl;
  const [imgError, setImgError] = React.useState(false);

  const avatarTooltip = [
    fullName ? `${fullName} (${email})` : email,
    `版本 v${APP_VERSION}${BUILD_TIME ? ` (${BUILD_TIME})` : ''}`,
  ].join(' · ');

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Tooltip arrow={true} title={avatarTooltip}>
        <VersionBadge onClick={handleMenu} aria-label={`当前版本 v${APP_VERSION}`}>
          v{APP_VERSION}
        </VersionBadge>
      </Tooltip>
      <Tooltip arrow={true} title={avatarTooltip}>
        <AvatarTrigger onClick={handleMenu} size="small" aria-label={fullName || email}>
          {avatarUrl && !imgError ? (
            <AvatarImage
              src={avatarUrl}
              alt={fullName || email}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <AvatarCircle>{initial}</AvatarCircle>
          )}
        </AvatarTrigger>
      </Tooltip>
      <Menu
        id="appbar-profile"
        anchorEl={anchorEl}
        keepMounted
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: (theme) => {
              const c = appleColors(isDarkTheme(theme));
              return {
                mt: 1,
                minWidth: '180px',
                borderRadius: '14px',
                border: `1px solid ${c.hairline}`,
                boxShadow: c.shadowFloat,
                backgroundColor: c.headerGlass,
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                '@media (prefers-reduced-transparency: reduce)': {
                  backgroundColor: c.surface,
                  backdropFilter: 'none',
                },
              };
            },
          },
        }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {fullName && (
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
                {fullName}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
              {email}
            </Typography>
          </Box>
        </MenuItem>
        <Divider />
        {client.fetchAssetStorageStats && (
          <MenuItem
            onClick={() => {
              handleClose();
              setStorageOpen(true);
            }}
            sx={{ fontWeight: 600 }}
          >
            <ListItemIcon>
              <StorageRoundedIcon fontSize="small" />
            </ListItemIcon>
            存储空间管理
          </MenuItem>
        )}
        <MenuItem onClick={handleLogout} sx={{ fontWeight: 600 }}>
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          <FormattedMessage id="menu.signout" defaultMessage="Sign Out" />
        </MenuItem>
        <Divider />
        <MenuItem disabled sx={{ opacity: '0.85 !important', py: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            版本 v{APP_VERSION}
            {BUILD_TIME ? ` · ${BUILD_TIME}` : ''}
          </Typography>
        </MenuItem>
      </Menu>
      <StorageQuotaDialog open={storageOpen} onClose={() => setStorageOpen(false)} />
    </Box>
  );
};

export default AccountMenu;
