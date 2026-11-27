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
import { styled, useTheme as useMuiTheme } from '@mui/material/styles';
import React, { use } from 'react';
import { FormattedMessage } from 'react-intl';
import { useFetchAccount } from '../../../classes/middleware';
import { ClientContext } from '../../../classes/provider/client-context';
import JwtTokenConfig from '../../../classes/jwt-token-config';
import { useOptionalTheme } from '../../../contexts/ThemeContext';
import { GoogleIcon } from '../../common/google-symbol';
import {
  APPLE_FONT_STACK,
  RADIUS_LG,
  RADIUS_MD,
  appleColors,
  applePressMixin,
  isDarkTheme,
} from '../appleDesign';
import StorageQuotaDialog from './StorageQuotaDialog';

declare const VITE_APP_VERSION: string | undefined;
declare const VITE_BUILD_TIME: string | undefined;

const APP_VERSION = typeof VITE_APP_VERSION !== 'undefined' ? VITE_APP_VERSION : '6.0.40';
const BUILD_TIME = typeof VITE_BUILD_TIME !== 'undefined' ? VITE_BUILD_TIME : '';

const AvatarTrigger = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    padding: '3px',
    borderRadius: '999px',
    border: 'none',
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.hoverFill,
    },
  };
});

const SidebarAccountButton = styled('button')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    appearance: 'none',
    width: 'calc(100% - 16px)',
    margin: 'auto 8px 10px 8px',
    padding: '8px 10px',
    backgroundColor: c.hoverFill,
    borderRadius: RADIUS_MD,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: APPLE_FONT_STACK,
    color: c.textPrimary,
    boxSizing: 'border-box',
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.activeFill,
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 2px ${c.amberRing}`,
    },
  };
});

const SidebarQuickGrid = styled('div', {
  shouldForwardProp: (prop) => prop !== 'columns',
})<{ columns: number }>(({ columns }) => ({
  display: 'grid',
  gridTemplateColumns: columns > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
  gap: '6px',
  width: 'calc(100% - 16px)',
  margin: '0 8px 6px 8px',
}));

const SidebarQuickButton = styled('button')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    appearance: 'none',
    minWidth: 0,
    minHeight: '34px',
    height: '34px',
    padding: '0 8px',
    backgroundColor: c.hoverFill,
    borderRadius: RADIUS_MD,
    border: 'none',
    boxShadow: c.shadowSubtle,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    fontFamily: APPLE_FONT_STACK,
    fontSize: '12.5px',
    fontWeight: 500,
    color: c.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxSizing: 'border-box',
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.activeFill,
      color: c.textPrimary,
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 2px ${c.amberRing}`,
    },
  };
});

const CollapsedQuickIconButton = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '36px',
    height: '36px',
    padding: 0,
    borderRadius: RADIUS_MD,
    border: 'none',
    boxShadow: c.shadowSubtle,
    backgroundColor: c.hoverFill,
    color: c.textPrimary,
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.activeFill,
      color: c.textPrimary,
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 2px ${c.amberRing}`,
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

interface AccountMenuProps {
  variant?: 'avatar' | 'sidebar';
  drawerOpen?: boolean;
}

const AccountMenu = ({
  variant = 'avatar',
  drawerOpen = true,
}: AccountMenuProps = {}): React.ReactElement | null => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement>();
  const [storageOpen, setStorageOpen] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const open = Boolean(anchorEl);
  const client = use(ClientContext);
  const queryClient = useQueryClient();
  const themeCtx = useOptionalTheme();
  const muiTheme = useMuiTheme();
  const isDark = (themeCtx?.mode ?? muiTheme.palette.mode) === 'dark';

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
    window.location.href = '/login';
  };

  const account = useFetchAccount();
  if (variant === 'sidebar' && !account) {
    return null;
  }

  const email = account?.email || 'a.jian0629@gmail.com';
  const fullName =
    account?.fullName ||
    [account?.firstname, account?.lastname].filter(Boolean).join(' ') ||
    account?.firstname;
  const displayName = fullName || email;
  const initial = displayName.trim().charAt(0).toUpperCase();
  const avatarUrl = account?.avatarUrl;

  const avatarTooltip = [
    fullName ? `${fullName} (${email})` : email,
    `版本 v${APP_VERSION}${BUILD_TIME ? ` (${BUILD_TIME})` : ''}`,
  ].join(' · ');

  const avatarNode =
    avatarUrl && !imgError ? (
      <AvatarImage
        src={avatarUrl}
        alt={displayName}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    ) : (
      <AvatarCircle>{initial}</AvatarCircle>
    );

  const hasStorageManager = Boolean(client.fetchAssetStorageStats);
  const themeToggleLabel = isDark ? '切换到浅色模式' : '切换到深色模式';
  const themeShortLabel = isDark ? '浅色模式' : '深色模式';

  return (
    <Box
      sx={
        variant === 'sidebar'
          ? {
              mt: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              flexShrink: 0,
            }
          : { display: 'inline-flex', alignItems: 'center', gap: 0.75 }
      }
    >
      {variant === 'sidebar' ? (
        drawerOpen ? (
          <>
            <SidebarQuickGrid columns={hasStorageManager ? 2 : 1}>
              <Tooltip arrow={true} title={themeToggleLabel}>
                <SidebarQuickButton
                  type="button"
                  aria-label={themeToggleLabel}
                  onClick={() => themeCtx?.toggleMode()}
                >
                  <GoogleIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
                  <span>{themeShortLabel}</span>
                </SidebarQuickButton>
              </Tooltip>
              {hasStorageManager && (
                <Tooltip arrow={true} title="存储空间管理">
                  <SidebarQuickButton
                    type="button"
                    aria-label="存储空间管理"
                    onClick={() => setStorageOpen(true)}
                  >
                    <GoogleIcon name="storage" size={16} />
                    <span>存储空间</span>
                  </SidebarQuickButton>
                </Tooltip>
              )}
            </SidebarQuickGrid>
            <SidebarAccountButton
              type="button"
              onClick={handleMenu}
              aria-label={displayName}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              {avatarNode}
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    fontSize: '13px',
                    lineHeight: 1.25,
                    color: 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '11px',
                    fontWeight: 400,
                    lineHeight: 1.25,
                    color: 'text.secondary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {email}
                </Typography>
              </Box>
              <GoogleIcon name="unfold_more" size={16} />
            </SidebarAccountButton>
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
            <Tooltip arrow={true} placement="right" title={themeToggleLabel}>
              <CollapsedQuickIconButton
                size="small"
                aria-label={themeToggleLabel}
                onClick={() => themeCtx?.toggleMode()}
              >
                <GoogleIcon name={isDark ? 'light_mode' : 'dark_mode'} size={18} />
              </CollapsedQuickIconButton>
            </Tooltip>
            {hasStorageManager && (
              <Tooltip arrow={true} placement="right" title="存储空间管理">
                <CollapsedQuickIconButton
                  size="small"
                  aria-label="存储空间管理"
                  onClick={() => setStorageOpen(true)}
                >
                  <GoogleIcon name="storage" size={18} />
                </CollapsedQuickIconButton>
              </Tooltip>
            )}
            <Tooltip arrow={true} placement="right" title={avatarTooltip}>
              <AvatarTrigger onClick={handleMenu} size="small" aria-label={displayName}>
                {avatarNode}
              </AvatarTrigger>
            </Tooltip>
          </Box>
        )
      ) : (
        <Tooltip arrow={true} title={avatarTooltip}>
          <AvatarTrigger onClick={handleMenu} size="small" aria-label={displayName}>
            {avatarNode}
          </AvatarTrigger>
        </Tooltip>
      )}
      <Menu
        id="appbar-profile"
        anchorEl={anchorEl}
        keepMounted
        open={open}
        onClose={handleClose}
        anchorOrigin={
          variant === 'sidebar'
            ? { vertical: 'top', horizontal: 'left' }
            : { vertical: 'bottom', horizontal: 'right' }
        }
        transformOrigin={
          variant === 'sidebar'
            ? { vertical: 'bottom', horizontal: 'left' }
            : { vertical: 'top', horizontal: 'right' }
        }
        slotProps={{
          paper: {
            sx: (theme) => {
              const c = appleColors(isDarkTheme(theme));
              return {
                mt: variant === 'sidebar' ? 0 : 1,
                mb: variant === 'sidebar' ? 1 : 0,
                minWidth: '210px',
                borderRadius: RADIUS_LG,
                border: 'none',
                boxShadow: c.shadowFloat,
                backgroundColor: isDarkTheme(theme) ? '#1C1C1E' : '#FFFFFF',
                '& .MuiMenuItem-root': {
                  borderRadius: RADIUS_MD,
                  margin: '2px 6px',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                },
              };
            },
          },
        }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {fullName && (
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
                {fullName}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
              {email}
            </Typography>
          </Box>
        </MenuItem>
        <Divider />
        {variant !== 'sidebar' && (
          <MenuItem
            onClick={() => {
              themeCtx?.toggleMode();
            }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <GoogleIcon name={isDark ? 'light_mode' : 'dark_mode'} size={18} />
            </ListItemIcon>
            {themeToggleLabel}
          </MenuItem>
        )}
        {variant !== 'sidebar' && hasStorageManager && (
          <MenuItem
            onClick={() => {
              handleClose();
              setStorageOpen(true);
            }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <GoogleIcon name="storage" size={18} />
            </ListItemIcon>
            存储空间管理
          </MenuItem>
        )}
        <MenuItem onClick={handleLogout}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <GoogleIcon name="logout" size={18} />
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
