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

import IconButton from '@mui/material/IconButton';
import { alpha, styled } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import { APPLE_FONT_STACK, appleColors, applePressMixin, isDarkTheme } from '../../appleDesign';

export const LabelContainer = styled('div', {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color?: string }>(({ theme, color }) => {
  const c = appleColors(isDarkTheme(theme));
  const pillTint = color ? alpha(color, isDarkTheme(theme) ? 0.18 : 0.12) : c.hoverFill;
  return {
    display: 'inline-flex',
    flexDirection: 'row',
    margin: '2px 3px',
    padding: '3px 9px',
    borderRadius: '999px',
    backgroundColor: pillTint,
    border: 'none',
    alignItems: 'center',
    fontSize: '0.76rem',
    fontWeight: 500,
    fontFamily: APPLE_FONT_STACK,
    color: c.textPrimary,
    '& .delete-button': {
      opacity: 0,
      transition: 'opacity 0.16s ease',
    },
    '&:hover .delete-button, &:focus-within .delete-button': {
      opacity: 1,
    },
  };
});

export const LabelText = styled('span')({
  marginLeft: '5px',
  marginRight: '2px',
  fontWeight: 500,
  fontFamily: APPLE_FONT_STACK,
});

type LabelIconProps = {
  /** The big label icon, rather than the small one of the maps list. */
  big?: boolean;
};

const iconSize = ({ big }: LabelIconProps) =>
  big ? { height: '1em', width: '1em' } : { height: '0.9em', width: '0.9em' };

const notBig = (prop: PropertyKey): boolean => prop !== 'big';

/** The label's tag, in the label's colour. */
export const LabelIcon = styled(LabelRoundedIcon, { shouldForwardProp: notBig })<LabelIconProps>(
  iconSize,
);

/** Removes the label; shown when the label is hovered. */
export const DeleteLabelButton = styled(IconButton)(({ theme }) => {
  const c = appleColors(isDarkTheme(theme));
  return {
    padding: '1px',
    marginLeft: '2px',
    color: c.textSecondary,
    ...applePressMixin,
    '&:hover': {
      color: '#EF4444',
      backgroundColor: 'transparent',
    },
  };
}) as typeof IconButton;

export const DeleteLabelIcon = styled(CloseRoundedIcon, {
  shouldForwardProp: notBig,
})<LabelIconProps>((props) => ({
  ...iconSize(props),
  color: 'inherit',
}));
