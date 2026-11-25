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
import GoogleIcon from '../google-icon';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import { APPLE_FONT_STACK } from '../../maps-page/appleDesign';

/**
 * Tactile Apple-styled Google OAuth Button (Apple Design §1, §4, §10).
 * Provides instantaneous pointer-down feedback, smooth cubic-bezier transitions,
 * and high-contrast typography.
 */
const StyledGoogleButton = styled(Button)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    fontFamily: APPLE_FONT_STACK,
    color: isDark ? '#F5F5F7' : '#1D1D1F',
    fontWeight: 600,
    fontSize: '15px',
    letterSpacing: '-0.01em',
    textTransform: 'none',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.95)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)'}`,
    borderRadius: '14px',
    height: '48px',
    width: '100%',
    flex: '1 1 auto',
    minWidth: '200px',
    boxShadow: isDark
      ? '0 2px 8px rgba(0, 0, 0, 0.3)'
      : '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition:
      'transform 110ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
    '&:hover': {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.13)' : '#FFFFFF',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.26)' : 'rgba(0, 0, 0, 0.22)',
      boxShadow: isDark
        ? '0 6px 18px rgba(0, 0, 0, 0.45)'
        : '0 4px 16px rgba(0, 0, 0, 0.08)',
    },
    '&:active': {
      transform: 'scale(0.98)',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(242, 242, 247, 0.9)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
      '&:active': {
        transform: 'none',
      },
    },
    '& .MuiButton-startIcon': {
      marginRight: '10px',
      display: 'flex',
      alignItems: 'center',
    },
  };
});

type GoogleButtonProps = {
  text: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
};

const GoogleButton: React.FunctionComponent<GoogleButtonProps> = ({
  text,
  onClick,
}: GoogleButtonProps) => {
  return (
    <StyledGoogleButton variant="outlined" startIcon={GoogleIcon} onClick={onClick}>
      {text}
    </StyledGoogleButton>
  );
};

export default GoogleButton;
