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
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { styled } from '@mui/material/styles';
import { useTheme } from '../../../contexts/ThemeContext';
import { useIntl } from 'react-intl';
import {
  APPLE_FONT_STACK,
  appleColors,
  applePressMixin,
  isDarkTheme,
} from '../../maps-page/appleDesign';

const PillToggleButton = styled(Button)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    borderRadius: '12px',
    fontSize: '0.84rem',
    fontWeight: 700,
    fontFamily: APPLE_FONT_STACK,
    padding: '6px 13px',
    minWidth: 'unset',
    backgroundColor: c.hoverFill,
    color: c.textPrimary,
    border: `1px solid ${c.hairline}`,
    ...applePressMixin,
    '&:hover': {
      backgroundColor: c.activeFill,
      borderColor: c.hairlineStrong,
    },
    '& .MuiButton-startIcon': {
      color: c.amber,
      marginRight: '6px',
    },
    '& .MuiButton-startIcon svg': {
      fontSize: '18px',
    },
  };
});

const ThemeToggleButton: React.FC = () => {
  const { mode, toggleMode } = useTheme();
  const intl = useIntl();

  const isDark = mode === 'dark';

  return (
    <Tooltip
      arrow={true}
      title={intl.formatMessage({
        id: 'theme.toggle',
        defaultMessage: 'Toggle Theme',
      })}
    >
      <PillToggleButton
        size="small"
        variant="text"
        disableElevation={true}
        onClick={toggleMode}
        startIcon={
          !isDark ? (
            <LightModeRoundedIcon sx={{ color: 'inherit' }} />
          ) : (
            <DarkModeRoundedIcon sx={{ color: 'inherit' }} />
          )
        }
      >
        <span className="message">
          {isDark
            ? intl.formatMessage({ id: 'theme.dark', defaultMessage: 'Dark' })
            : intl.formatMessage({ id: 'theme.light', defaultMessage: 'Light' })}
        </span>
      </PillToggleButton>
    </Tooltip>
  );
};

export default ThemeToggleButton;
