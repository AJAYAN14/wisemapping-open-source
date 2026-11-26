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
import Capability from '../../classes/action/capability';
import Model from '../../classes/model/editor';
import ActionConfig from '../../classes/action/action-config';
import Toolbar from '../toolbar';
import { buildDeleteSelectionConfig, buildEditorPanelConfig } from './configBuilder';
import { useSelection } from '../../hooks/useSelection';
import type { UploadTopicImageFn } from '../../hooks/useEditor';
import { EDITOR_Z_INDEX } from '../../theme/layout';
import ToolbarPosition from '../../classes/model/toolbar-position';

type EditorToolbarProps = {
  model: Model | undefined;
  capability: Capability;
  uploadTopicImage?: UploadTopicImageFn | undefined;
  hasAppBar?: boolean | undefined;
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
  hasAppBar = true,
}: EditorToolbarProps): ReactElement => {
  const intl = useIntl();
  const theme = useTheme();
  const isCompactViewport = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const selection = useSelection(model);

  const config = useMemo(() => {
    if (capability.isHidden('edition-toolbar') || !model || !selection.isMapLoaded) {
      return undefined;
    }
    // On desktop when AppBar is present, contextual formatting actions live in the center of AppBar.
    if (hasAppBar && !isCompactViewport) {
      return undefined;
    }

    const hasSelection = selection.topicCount > 0 || selection.relationshipCount > 0;
    if (!hasSelection) {
      // Keep viewport unobstructed when nothing is selected.
      return undefined;
    }

    const baseConfig = buildEditorPanelConfig(model, intl, selection, uploadTopicImage);
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

    const deleteAction = buildDeleteSelectionConfig(model, intl, selection, {
      testId: 'mobile-delete-topic-button',
    });
    if (deleteAction) {
      contextActions.push(deleteAction);
    }

    return contextActions;
  }, [capability, hasAppBar, intl, isCompactViewport, model, selection, uploadTopicImage]);

  return (
    <span>
      {config ? <Toolbar configurations={config} position={MOBILE_CONTEXT_DOCK_POSITION} /> : <></>}
    </span>
  );
};
export default EditorToolbar;
