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
import { ReactElement, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Capability from '../../classes/action/capability';
import Model from '../../classes/model/editor';
import ActionConfig from '../../classes/action/action-config';
import Toolbar from '../toolbar';
import { buildEditorPanelConfig } from './configBuilder';
import { useSelection } from '../../hooks/useSelection';
import type { UploadTopicImageFn } from '../../hooks/useEditor';
import { EDITOR_LAYOUT, EDITOR_Z_INDEX } from '../../theme/layout';
import ToolbarPosition from '../../classes/model/toolbar-position';

type EditorToolbarProps = {
  model: Model | undefined;
  capability: Capability;
  uploadTopicImage?: UploadTopicImageFn | undefined;
};

const MOBILE_CONTEXT_DOCK_POSITION: ToolbarPosition = {
  vertical: false,
  position: {
    right: '0px',
    bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))',
  },
  zIndex: EDITOR_Z_INDEX.formattingToolbar,
  canvasInset: 'bottom',
};

const EditorToolbar = ({
  model,
  capability,
  uploadTopicImage,
}: EditorToolbarProps): ReactElement => {
  const intl = useIntl();
  const theme = useTheme();
  const isCompactViewport = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const selection = useSelection(model);

  const config = useMemo(() => {
    if (capability.isHidden('edition-toolbar') || !model || !selection.isMapLoaded) {
      return undefined;
    }
    const baseConfig = buildEditorPanelConfig(model, intl, selection, uploadTopicImage);
    if (!isCompactViewport) {
      return baseConfig;
    }

    const hasSelection = selection.topicCount > 0 || selection.relationshipCount > 0;
    if (!hasSelection) {
      // Keep mobile viewport unobstructed when nothing is selected.
      return undefined;
    }

    const enabledActions = baseConfig.filter((item) => !(item.disabled && item.disabled()));
    const contextActions: (ActionConfig | undefined)[] = [];

    if (selection.topicCount === 1) {
      const editLabel = intl.formatMessage({
        id: 'editor-panel.tooltip-edit-topic',
        defaultMessage: 'Edit',
      });
      contextActions.push({
        icon: <EditRoundedIcon />,
        tooltip: editLabel,
        ariaLabel: editLabel,
        'data-testid': 'mobile-edit-topic-button',
        onClick: () => {
          model.getDesigner()?.editSelectedTopic?.();
        },
      });
    }

    contextActions.push(...enabledActions);

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

    if (!isOnlyCentralSelected) {
      const deleteLabel = intl.formatMessage({
        id: 'editor-panel.tooltip-delete-selected',
        defaultMessage: 'Delete',
      });
      contextActions.push({
        icon: <DeleteOutlineRoundedIcon />,
        tooltip: deleteLabel,
        ariaLabel: deleteLabel,
        'data-testid': 'mobile-delete-topic-button',
        onClick: () => {
          model.getDesigner()?.deleteSelectedEntities?.();
        },
      });
    }

    return contextActions;
  }, [capability, intl, isCompactViewport, model, selection, uploadTopicImage]);

  const position = isCompactViewport
    ? MOBILE_CONTEXT_DOCK_POSITION
    : {
        vertical: true,
        position: {
          right: EDITOR_LAYOUT.formattingToolbar.right,
          top: EDITOR_LAYOUT.formattingToolbar.top,
        },
        zIndex: EDITOR_Z_INDEX.formattingToolbar,
        canvasInset: 'right' as const,
      };

  return <span>{config ? <Toolbar configurations={config} position={position} /> : <></>}</span>;
};
export default EditorToolbar;
