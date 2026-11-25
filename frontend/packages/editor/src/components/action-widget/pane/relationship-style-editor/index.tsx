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

import { ReactElement } from 'react';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import { FormattedMessage, useIntl } from 'react-intl';
import { styled } from '@mui/material/styles';
import {
  RelationshipStartArrowIcon,
  RelationshipEndArrowIcon,
} from '../../../icons/RelationshipArrowIcons';

import NodeProperty from '../../../../classes/model/node-property';
import { StrokeStyle } from '@wisemapping/mindplot';
import ColorPicker from '../color-picker';
import {
  PaneCard,
  PaneCenteredRow,
  PaneCloseButton,
  PaneControlRow,
  PaneDivider,
  PaneSection,
  PaneSectionTitle,
} from '../shared/StyledPane';

const ActionButton = styled(IconButton)<{ selected?: boolean }>(({ selected, theme }) => ({
  padding: '8px',
  width: '32px',
  height: '32px',
  border: selected ? `2px solid ${theme.palette.primary.main}` : '2px solid #e0e0e0',
  borderRadius: '4px',
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
}));

interface RelationshipStyleEditorProps {
  closeModal: () => void;
  strokeStyleModel: NodeProperty<StrokeStyle>;
  startArrowModel: NodeProperty<boolean>;
  endArrowModel: NodeProperty<boolean>;
  colorModel: NodeProperty<string | undefined>;
}

const RelationshipStyleEditor = (props: RelationshipStyleEditorProps): ReactElement => {
  const intl = useIntl();

  const handleStrokeStyleChange = (style: StrokeStyle) => {
    const setValue = props.strokeStyleModel.setValue;
    if (setValue) {
      setValue(style);
    }
  };

  const handleStartArrowToggle = () => {
    const setValue = props.startArrowModel.setValue;
    if (setValue) {
      setValue(!props.startArrowModel.getValue());
    }
  };

  const handleEndArrowToggle = () => {
    const setValue = props.endArrowModel.setValue;
    if (setValue) {
      setValue(!props.endArrowModel.getValue());
    }
  };

  return (
    <PaneCard>
      <PaneCloseButton onClick={props.closeModal}>
        <CloseRoundedIcon />
      </PaneCloseButton>

      {/* Relationship Color */}
      <PaneSection>
        <PaneSectionTitle variant="subtitle2" gutterBottom>
          <FormattedMessage
            id="relationship-style-editor.color"
            defaultMessage="Relationship Color"
          />
        </PaneSectionTitle>
        <PaneCenteredRow>
          <ColorPicker closeModal={() => {}} colorModel={props.colorModel} />
        </PaneCenteredRow>
      </PaneSection>

      {/* Line Style & Arrows */}
      <PaneSection>
        <PaneSectionTitle variant="subtitle2" gutterBottom>
          <FormattedMessage
            id="relationship-style-editor.line-arrows"
            defaultMessage="Line Style & Arrows"
          />
        </PaneSectionTitle>
        <PaneControlRow>
          <ActionButton
            onClick={() => handleStrokeStyleChange(StrokeStyle.SOLID)}
            selected={props.strokeStyleModel.getValue() === StrokeStyle.SOLID}
            aria-label={intl.formatMessage({
              id: 'relationship-style-editor.solid-line',
              defaultMessage: 'Solid Line',
            })}
            title={intl.formatMessage({
              id: 'relationship-style-editor.solid-line-tooltip',
              defaultMessage: 'Solid line style',
            })}
          >
            <RemoveRoundedIcon />
          </ActionButton>
          <ActionButton
            onClick={() => handleStrokeStyleChange(StrokeStyle.DASHED)}
            selected={props.strokeStyleModel.getValue() === StrokeStyle.DASHED}
            aria-label={intl.formatMessage({
              id: 'relationship-style-editor.dashed-line',
              defaultMessage: 'Dashed Line',
            })}
            title={intl.formatMessage({
              id: 'relationship-style-editor.dashed-line-tooltip',
              defaultMessage: 'Dashed line style',
            })}
          >
            <MoreHorizRoundedIcon />
          </ActionButton>
          <ActionButton
            onClick={() => handleStrokeStyleChange(StrokeStyle.DOTTED)}
            selected={props.strokeStyleModel.getValue() === StrokeStyle.DOTTED}
            aria-label={intl.formatMessage({
              id: 'relationship-style-editor.dotted-line',
              defaultMessage: 'Dotted Line',
            })}
            title={intl.formatMessage({
              id: 'relationship-style-editor.dotted-line-tooltip',
              defaultMessage: 'Dotted line style',
            })}
          >
            <FiberManualRecordRoundedIcon />
          </ActionButton>

          <PaneDivider orientation="vertical" flexItem />

          <ActionButton
            onClick={handleEndArrowToggle}
            selected={props.endArrowModel.getValue()}
            aria-label={intl.formatMessage({
              id: 'relationship-style-editor.end-arrow',
              defaultMessage: 'End Arrow',
            })}
            title={intl.formatMessage({
              id: 'relationship-style-editor.end-arrow-tooltip',
              defaultMessage: 'Toggle end arrow',
            })}
          >
            <RelationshipStartArrowIcon />
          </ActionButton>
          <ActionButton
            onClick={handleStartArrowToggle}
            selected={props.startArrowModel.getValue()}
            aria-label={intl.formatMessage({
              id: 'relationship-style-editor.start-arrow',
              defaultMessage: 'Start Arrow',
            })}
            title={intl.formatMessage({
              id: 'relationship-style-editor.start-arrow-tooltip',
              defaultMessage: 'Toggle start arrow',
            })}
          >
            <RelationshipEndArrowIcon />
          </ActionButton>
        </PaneControlRow>
      </PaneSection>
    </PaneCard>
  );
};

export default RelationshipStyleEditor;
