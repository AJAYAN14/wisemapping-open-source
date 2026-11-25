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

import Box from '@mui/material/Box';
import RadioGroup from '@mui/material/RadioGroup';
import { styled } from '@mui/material/styles';
import { APPLE_FONT_STACK, appleColors, applePressMixin, isDarkTheme } from '../../appleDesign';

export const FormatCardList = styled(RadioGroup)({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '4px',
});

export const FormatCard = styled('label', {
  shouldForwardProp: (prop) => prop !== 'selected' && prop !== 'disabled',
})<{ selected: boolean; disabled?: boolean }>(({ theme, selected, disabled }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '14px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontFamily: APPLE_FONT_STACK,
    backgroundColor: selected ? c.amberSoft : c.surface,
    border: `1.5px solid ${selected ? c.amber : c.hairlineStrong}`,
    boxShadow: selected ? `0 0 0 3px ${c.amberRing}` : c.shadowSubtle,
    ...applePressMixin,
    transition:
      'transform 110ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
    '&:hover': disabled
      ? undefined
      : {
          backgroundColor: selected ? c.amberSoftHover : c.hoverFill,
          borderColor: selected ? c.amber : c.hairlineStrong,
        },
    '&:focus-within': {
      outline: `2px solid ${c.amber}`,
      outlineOffset: '2px',
    },
  };
});

export const FormatIconBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected: boolean }>(({ theme, selected }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '1px',
    backgroundColor: selected ? c.amber : c.hoverFill,
    color: selected ? '#FFFFFF' : c.textSecondary,
    transition: 'background-color 140ms ease, color 140ms ease',
  };
});

export const FormatBody = styled(Box)({
  flex: 1,
  minWidth: 0,
});

export const FormatTitle = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: 1.35,
    color: c.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  };
});

export const FormatBadge = styled('span', {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected: boolean }>(({ theme, selected }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    fontSize: '11.5px',
    fontWeight: 600,
    lineHeight: 1.2,
    padding: '2px 8px',
    borderRadius: '999px',
    backgroundColor: selected ? c.amberSoftHover : c.hoverFill,
    color: selected ? c.amberText : c.textSecondary,
  };
});

export const FormatDescription = styled('div')(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    marginTop: '4px',
    fontSize: '13px',
    lineHeight: 1.45,
    color: c.textSecondary,
  };
});
