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
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

import ActionConfig from '../../classes/action/action-config';
import NodePropertyValueModelBuilder from '../../classes/model/node-property-builder';
import TopicLinkEditor from '../action-widget/pane/topic-link-editor';
import RichTextNoteEditor from '../action-widget/pane/rich-text-note-editor';
import TopicImagePicker from '../action-widget/pane/topic-image-picker';
import TopicFontEditor from '../action-widget/pane/topic-font-editor';
import RelationshipStyleEditor from '../action-widget/pane/relationship-style-editor';
import RelationshipStyleIcon from '../icons/RelationshipStyleIcon';
import Editor from '../../classes/model/editor';
import { IntlShape } from 'react-intl';
import { formatTooltip } from '../visualization-toolbar/utils';
import type { SelectionSnapshot } from '../../hooks/useSelection';
import type { UploadTopicImageFn } from '../../hooks/useEditor';

/**
 * `selection` is a snapshot from useSelection rather than something read off
 * the designer here: these `disabled` thunks are evaluated during render, and
 * polling the designer made them correct only when an unrelated re-render
 * happened to occur after the selection changed.
 */
export function buildEditorPanelConfig(
  model: Editor,
  intl: IntlShape,
  selection: SelectionSnapshot,
  uploadTopicImage?: UploadTopicImageFn | undefined,
): ActionConfig[] {
  const modelBuilder = new NodePropertyValueModelBuilder(model.getDesigner());
  const noTopicSelected = selection.topicCount === 0;
  const noRelationshipSelected = selection.relationshipCount === 0;

  const relationshipStyleConfiguration: ActionConfig = {
    icon: <RelationshipStyleIcon />,
    tooltip: intl.formatMessage({
      id: 'editor-panel.tooltip-relationship-style',
      defaultMessage: 'Relationship Style',
    }),
    options: [
      {
        render: (closeModal) => {
          return (
            <RelationshipStyleEditor
              closeModal={closeModal}
              strokeStyleModel={modelBuilder.getRelationshipStrokeStyleModel()}
              startArrowModel={modelBuilder.getRelationshipStartArrowModel()}
              endArrowModel={modelBuilder.getRelationshipEndArrowModel()}
              colorModel={modelBuilder.getRelationshipColorModel()}
            />
          );
        },
      },
    ],
    disabled: () => noRelationshipSelected,
  };

  /**
   * submenu to manipulate node font
   */
  const fontFormatToolbarConfiguration: ActionConfig = {
    icon: <TextFieldsRoundedIcon />,
    tooltip: intl.formatMessage({
      id: 'editor-panel.tooltip-topic-font-style',
      defaultMessage: 'Font Style',
    }),
    options: [
      {
        render: (closeModal) => {
          return (
            <TopicFontEditor
              closeModal={closeModal}
              fontSizeModel={modelBuilder.getFontSizeModel()}
              fontWeightModel={modelBuilder.fontWeigthModel()}
              fontStyleModel={modelBuilder.getFontStyleModel()}
              fontColorModel={modelBuilder.getFontColorModel()}
              model={model}
            />
          );
        },
      },
    ],
    disabled: () => noTopicSelected,
  };

  /**
   * tool for node link edition
   */
  const editLinkUrlConfiguration: ActionConfig = {
    icon: <LinkRoundedIcon />,
    tooltip: formatTooltip(
      intl.formatMessage({ id: 'editor-panel.tooltip-add-link', defaultMessage: 'Add Link' }),
      'L',
    ),
    options: [
      {
        render: (closeModal) => {
          return <TopicLinkEditor closeModal={closeModal} urlModel={modelBuilder.getLinkModel()} />;
        },
      },
    ],
    disabled: () => noTopicSelected,
  };

  /**
   * tool for node note edition
   */
  const editNoteConfiguration: ActionConfig = {
    icon: <StickyNote2OutlinedIcon />,
    tooltip: formatTooltip(
      intl.formatMessage({ id: 'editor-panel.tooltip-add-note', defaultMessage: 'Add Note' }),
      'K',
    ),
    options: [
      {
        tooltip: intl.formatMessage({
          id: 'editor-panel.note-panel-title',
          defaultMessage: 'Note',
        }),
        render: (closeModal) => {
          return (
            <RichTextNoteEditor closeModal={closeModal} noteModel={modelBuilder.getNoteModel()} />
          );
        },
      },
    ],
    disabled: () => noTopicSelected,
  };

  /**
   * tool for topic image selection
   */
  const editTopicImageConfiguration: ActionConfig = {
    icon: <ImageOutlinedIcon />,
    tooltip: intl.formatMessage({
      id: 'editor-panel.tooltip-add-topic-image',
      defaultMessage: 'Add Topic Image',
    }),
    options: [
      {
        tooltip: intl.formatMessage({
          id: 'editor-panel.tooltip-add-topic-image',
          defaultMessage: 'Add Topic Image',
        }),
        render: (closeModal) => {
          return (
            <TopicImagePicker
              triggerClose={closeModal}
              topicImageModel={modelBuilder.getTopicImageModel()}
              onUploadTopicImage={uploadTopicImage}
            />
          );
        },
      },
    ],
    disabled: () => noTopicSelected,
  };

  return [
    fontFormatToolbarConfiguration,
    editTopicImageConfiguration,
    editNoteConfiguration,
    editLinkUrlConfiguration,
    ...(selection.relationshipCount > 0 ? [relationshipStyleConfiguration] : []),
  ];
}

/**
 * Builds the delete action for currently selected topics/relationships when deletable
 * (omitted when only the central topic is selected).
 */
export function buildDeleteSelectionConfig(
  model: Editor,
  intl: IntlShape,
  selection: SelectionSnapshot,
  options?: { testId?: string; includeShortcutHint?: boolean },
): ActionConfig | undefined {
  if (selection.topicCount === 0 && selection.relationshipCount === 0) {
    return undefined;
  }

  const selectedTopics = (() => {
    try {
      return model.getDesigner()?.getModel?.()?.filterSelectedTopics?.() ?? [];
    } catch {
      return [];
    }
  })();
  const isOnlyCentralSelected =
    selectedTopics.length === 1 &&
    Boolean((selectedTopics[0] as { isCentralTopic?: () => boolean })?.isCentralTopic?.()) &&
    selection.relationshipCount === 0;

  if (isOnlyCentralSelected) {
    return undefined;
  }

  const deleteLabel = intl.formatMessage({
    id: 'editor-panel.tooltip-delete-selected',
    defaultMessage: 'Delete',
  });
  return {
    icon: <DeleteOutlineRoundedIcon />,
    tooltip: options?.includeShortcutHint ? `${deleteLabel} (Delete / Backspace)` : deleteLabel,
    ariaLabel: deleteLabel,
    ...(options?.testId ? { 'data-testid': options.testId } : {}),
    onClick: () => {
      model.getDesigner()?.deleteSelectedEntities?.();
    },
  };
}
