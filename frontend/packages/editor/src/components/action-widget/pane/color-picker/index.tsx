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
import { ReactElement } from 'react';
import NodeProperty from '../../../../classes/model/node-property';
import colors from './colors.json';
import { styled } from '@mui/material/styles';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { useIntl } from 'react-intl';

const NoneColorCircle = styled(Box)<{ selected?: boolean }>(({ selected, theme }) => ({
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: selected
    ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.primary.main}`
    : 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  transition: 'transform 120ms ease, box-shadow 120ms ease',
  '&:hover': {
    transform: 'scale(1.1)',
  },
  '& svg': {
    fontSize: '14px',
    color: theme.palette.error.main,
  },
}));

/**
 * Color picker for toolbar
 */
const ColorPicker = (props: {
  closeModal: () => void;
  colorModel: NodeProperty<string | undefined>;
  hideNoneOption?: boolean;
}): ReactElement => {
  const intl = useIntl();
  const currentValue = props.colorModel.getValue();
  const isNoneSelected = currentValue === undefined;

  const handleNoneClick = () => {
    const setValue = props.colorModel.setValue;
    if (setValue) {
      setValue(undefined);
    }
    props.closeModal();
  };

  const handleColorChange = (color: { hex: string }) => {
    const setValue = props.colorModel.setValue;
    if (setValue) {
      setValue(color.hex);
    }
    props.closeModal();
  };

  const colorLabel = intl.formatMessage({
    id: 'color-picker.color',
    defaultMessage: 'Color',
  });

  const defaultColorLabel = intl.formatMessage({
    id: 'color-picker.default-color',
    defaultMessage: 'Default color',
  });

  return (
    <Box component="div" aria-label={colorLabel}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 22px)',
          gap: '7px',
          justifyContent: 'center',
        }}
      >
        {!props.hideNoneOption && (
          <NoneColorCircle
            selected={isNoneSelected}
            onClick={handleNoneClick}
            aria-label={defaultColorLabel}
            role="button"
            tabIndex={0}
          >
            <BlockRoundedIcon />
          </NoneColorCircle>
        )}
        {(props.hideNoneOption ? colors : colors.slice(1)).map((color) => (
          <Box
            key={color}
            component="button"
            aria-label={color}
            title={color}
            sx={(theme) => ({
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: color,
              border: 'none',
              boxShadow:
                currentValue === color
                  ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.primary.main}`
                  : 'inset 0 0 0 1px rgba(128, 128, 128, 0.22)',
              cursor: 'pointer',
              padding: 0,
              transition: 'transform 120ms ease, box-shadow 120ms ease',
              '&:hover': {
                transform: 'scale(1.1)',
              },
            })}
            onClick={() => handleColorChange({ hex: color })}
          />
        ))}
      </Box>
    </Box>
  );
};

export default ColorPicker;
