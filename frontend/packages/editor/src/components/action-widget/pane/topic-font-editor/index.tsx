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

import { ReactElement, useState, useEffect } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TextIncreaseRoundedIcon from '@mui/icons-material/TextIncreaseRounded';
import TextDecreaseRoundedIcon from '@mui/icons-material/TextDecreaseRounded';
import FormatBoldRoundedIcon from '@mui/icons-material/FormatBoldRounded';
import FormatItalicRoundedIcon from '@mui/icons-material/FormatItalicRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { FormattedMessage, useIntl } from 'react-intl';

import NodeProperty from '../../../../classes/model/node-property';
import { SwitchValueDirection } from '../../../../classes/model/value-stepper';
import ColorPicker from '../color-picker';
import Editor from '../../../../classes/model/editor';
import {
  PaneCenteredRow,
  PaneCloseButton,
  PaneControlRow,
  PaneDivider,
  PaneSection,
  PaneSectionTitle,
} from '../shared/StyledPane';
import { ActionButton, FontPaneContainer, ResetButton, ResetSection } from './styled';

interface TopicFontEditorProps {
  closeModal: () => void;
  fontSizeModel: NodeProperty<number>;
  fontWeightModel: NodeProperty<string | undefined>;
  fontStyleModel: NodeProperty<string>;
  fontColorModel: NodeProperty<string | undefined>;
  model?: Editor;
}

const TopicFontEditor = (props: TopicFontEditorProps): ReactElement => {
  const intl = useIntl();
  const [currentWeight, setCurrentWeight] = useState<string | undefined>(
    props.fontWeightModel.getValue(),
  );
  const [currentStyle, setCurrentStyle] = useState<string>(props.fontStyleModel.getValue());

  const { model, fontWeightModel, fontStyleModel } = props;
  const mapLoaded = model?.isMapLoadded() ?? false;

  useEffect(() => {
    if (!model || !mapLoaded) {
      return undefined;
    }
    const designer = model.getDesigner();
    if (!designer) {
      return undefined;
    }

    const handleUpdate = () => {
      setCurrentWeight(fontWeightModel.getValue());
      setCurrentStyle(fontStyleModel.getValue());
    };
    designer.addEvent('modelUpdate', handleUpdate);
    designer.addEvent('onfocus', handleUpdate);
    designer.addEvent('onblur', handleUpdate);
    return () => {
      designer.removeEvent('modelUpdate', handleUpdate);
      designer.removeEvent('onfocus', handleUpdate);
      designer.removeEvent('onblur', handleUpdate);
    };
  }, [model, mapLoaded, fontWeightModel, fontStyleModel]);

  const handleFontSizeIncrease = () => {
    const switchValue = props.fontSizeModel.switchValue;
    if (switchValue) {
      switchValue(SwitchValueDirection.up);
    }
  };

  const handleFontSizeDecrease = () => {
    const switchValue = props.fontSizeModel.switchValue;
    if (switchValue) {
      switchValue(SwitchValueDirection.down);
    }
  };

  const handleBoldToggle = () => {
    const switchValue = props.fontWeightModel.switchValue;
    if (switchValue) {
      switchValue();
    }
  };

  const handleItalicToggle = () => {
    const switchValue = props.fontStyleModel.switchValue;
    if (switchValue) {
      switchValue();
    }
  };

  const hasCustomColor = props.fontColorModel.getValue() !== undefined;

  const handleResetToDefault = () => {
    props.fontColorModel.setValue?.(undefined);
  };

  return (
    <FontPaneContainer>
      <PaneCloseButton onClick={props.closeModal}>
        <CloseRoundedIcon />
      </PaneCloseButton>
      {/* Font Color */}
      <PaneSection>
        <PaneSectionTitle variant="subtitle2" gutterBottom>
          <FormattedMessage id="topic-font-editor.font-color" defaultMessage="Font Color" />
        </PaneSectionTitle>
        <PaneCenteredRow>
          <ColorPicker
            closeModal={() => {}}
            colorModel={props.fontColorModel}
            hideNoneOption={true}
          />
        </PaneCenteredRow>
      </PaneSection>
      {/* Font Size & Font Style */}
      <PaneSection>
        <PaneSectionTitle variant="subtitle2" gutterBottom>
          <FormattedMessage
            id="topic-font-editor.font-size-style"
            defaultMessage="Font Size & Style"
          />
        </PaneSectionTitle>
        <PaneControlRow>
          <ActionButton
            onClick={handleFontSizeIncrease}
            aria-label={intl.formatMessage({
              id: 'topic-font-editor.increase-size',
              defaultMessage: 'Bigger',
            })}
            title={intl.formatMessage({
              id: 'topic-font-editor.increase-size-tooltip',
              defaultMessage: 'Increase font size',
            })}
          >
            <TextIncreaseRoundedIcon />
          </ActionButton>
          <ActionButton
            onClick={handleFontSizeDecrease}
            aria-label={intl.formatMessage({
              id: 'topic-font-editor.decrease-size',
              defaultMessage: 'Smaller',
            })}
            title={intl.formatMessage({
              id: 'topic-font-editor.decrease-size-tooltip',
              defaultMessage: 'Decrease font size',
            })}
          >
            <TextDecreaseRoundedIcon />
          </ActionButton>

          <PaneDivider orientation="vertical" flexItem />

          <ActionButton
            onClick={handleBoldToggle}
            selected={currentWeight === 'bold'}
            aria-label={
              intl.formatMessage({
                id: 'topic-font-editor.bold',
                defaultMessage: 'Bold',
              }) +
              (currentWeight === 'bold'
                ? ` (${intl.formatMessage({
                    id: 'topic-font-editor.active',
                    defaultMessage: 'active',
                  })})`
                : '')
            }
            title={intl.formatMessage({
              id: 'topic-font-editor.bold-tooltip',
              defaultMessage: 'Toggle bold',
            })}
          >
            <FormatBoldRoundedIcon />
          </ActionButton>
          <ActionButton
            onClick={handleItalicToggle}
            selected={currentStyle === 'italic'}
            aria-label={
              intl.formatMessage({
                id: 'topic-font-editor.italic',
                defaultMessage: 'Italic',
              }) +
              (currentStyle === 'italic'
                ? ` (${intl.formatMessage({
                    id: 'topic-font-editor.active',
                    defaultMessage: 'active',
                  })})`
                : '')
            }
            title={intl.formatMessage({
              id: 'topic-font-editor.italic-tooltip',
              defaultMessage: 'Toggle italic',
            })}
          >
            <FormatItalicRoundedIcon />
          </ActionButton>
        </PaneControlRow>
      </PaneSection>
      {/* Reset to Default Button - At bottom */}
      {hasCustomColor && (
        <ResetSection>
          <ResetButton
            variant="outlined"
            size="small"
            startIcon={<BlockRoundedIcon />}
            onClick={handleResetToDefault}
            fullWidth
          >
            <FormattedMessage
              id="topic-font-editor.reset-to-default"
              defaultMessage="Reset to Default"
            />
          </ResetButton>
        </ResetSection>
      )}
    </FontPaneContainer>
  );
};

export default TopicFontEditor;
