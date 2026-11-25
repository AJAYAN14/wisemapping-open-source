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
import { styled } from '@mui/material/styles';
import React, { use } from 'react';
import { FormattedMessage } from 'react-intl';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useFetchAccount } from '../../../classes/middleware';
import { ClientContext } from '../../../classes/provider/client-context';
import JwtTokenConfig from '../../../classes/jwt-token-config';
import { appleColors, applePressMixin, isDarkTheme } from '../appleDesign';

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
  const initial = (account?.firstname || email).trim().charAt(0).toUpperCase();

  return (
    <span>
      <Tooltip arrow={true} title={email}>
        <AvatarTrigger onClick={handleMenu} size="small" aria-label={email}>
          <AvatarCircle>{initial}</AvatarCircle>
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
        <MenuItem disabled sx={{ opacity: '0.9 !important' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {email}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ fontWeight: 600 }}>
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          <FormattedMessage id="menu.signout" defaultMessage="Sign Out" />
        </MenuItem>
      </Menu>
    </span>
  );
};

export default AccountMenu;
