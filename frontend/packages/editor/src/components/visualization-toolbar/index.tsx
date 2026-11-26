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
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { IntlShape, useIntl } from 'react-intl';
import ActionConfig from '../../classes/action/action-config';
import Capability from '../../classes/action/capability';
import Editor from '../../classes/model/editor';
import Model from '../../classes/model/editor';
import KeyboardShorcutsHelp from '../action-widget/pane/keyboard-shortcut-help';
import { DesignerKeyboard, isMacPlatform } from '@wisemapping/mindplot';
import Toolbar from '../toolbar';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import SettingsEthernetRoundedIcon from '@mui/icons-material/SettingsEthernetRounded';
import { AddChildTopicIcon, AddSiblingTopicIcon } from '../icons/TopicActionIcons';
import { handleExpandByLevel, buildExpandByLevelConfig } from './expand-by-level-icon';
import { formatTooltip } from './utils';
import { EDITOR_LAYOUT, EDITOR_Z_INDEX } from '../../theme/layout';
import ZoomDisplay from './zoom-display';
import { useTheme } from '../../contexts/ThemeContext';
import { SelectionSnapshot, useSelection } from '../../hooks/useSelection';
import {
  buildFindInMapConfig,
  buildOutlineViewConfig,
  FindInMapState,
  useFindInMapShortcut,
  useFindInMapState,
} from './mapViewActions';

// Helper function to check if any nodes are currently collapsed
const areNodesCollapsed = (model: Editor): boolean => {
  if (!model?.isMapLoadded()) return false;
  const allTopics = model.getDesigner().getModel().getTopics();
  return allTopics.some(
    (topic) => topic.getType() !== 'CentralTopic' && topic.areChildrenShrunken(),
  );
};

export type { FindInMapState };

export function buildVisualizationToolbarConfig(
  model: Editor,
  capability: Capability,
  intl: IntlShape,
  currentExpandLevel: number,
  setExpandLevel: (level: number) => void,
  themeMode?: 'light' | 'dark',
  toggleTheme?: () => void,
  findInMap?: FindInMapState,
  hasAppBar = true,
  selection?: SelectionSnapshot,
  isCentralFocused?: boolean,
): (ActionConfig | undefined)[] {
  const zoomToFitLabel = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-zoom-to-fit',
    defaultMessage: 'Zoom to Fit',
  });
  const zoomOutLabel = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-zoom-out',
    defaultMessage: 'Zoom Out',
  });
  const addSiblingLabel = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-add-sibling',
    defaultMessage: 'Add Sibling Topic',
  });
  const addChildLabel = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-add-child',
    defaultMessage: 'Add Child Topic',
  });
  const addRelationshipLabel = intl.formatMessage({
    id: 'editor-panel.tooltip-add-relationship',
    defaultMessage: 'Add Relationship',
  });

  // Check if we're in public or embedded view
  const isPublicOrEmbedded =
    capability.mode === 'viewonly-public' || capability.mode === 'viewonly-private';
  const canEditTopics = !capability.isHidden('edition-toolbar');
  const showKeyboardShortcuts = !capability.isHidden('keyboard-shortcuts');

  const getSelectedTopicCount = (): number => {
    if (selection) {
      return selection.topicCount;
    }
    try {
      return model.getDesigner()?.getModel?.()?.filterSelectedTopics?.().length ?? 0;
    } catch {
      return 0;
    }
  };

  const getIsCentralSelected = (): boolean => {
    if (isCentralFocused !== undefined) {
      return isCentralFocused;
    }
    try {
      const designerModel = model.getDesigner()?.getModel?.();
      const central = designerModel?.getCentralTopic?.() as
        { isOnFocus?: () => boolean } | undefined;
      if (central && typeof central.isOnFocus === 'function') {
        return central.isOnFocus();
      }
      const selected = designerModel?.filterSelectedTopics?.() ?? [];
      return selected.length === 1 && selected[0]?.getType?.() === 'CentralTopic';
    } catch {
      return false;
    }
  };

  const nodesCollapsed = areNodesCollapsed(model);

  return [
    {
      icon: <CenterFocusStrongRoundedIcon />,
      tooltip: formatTooltip(zoomToFitLabel, '0'),
      ariaLabel: zoomToFitLabel,
      onClick: () => {
        model.getDesigner().zoomToFit();
      },
      disabled: () => !model?.isMapLoadded(),
    },
    {
      icon: <ZoomOutRoundedIcon />,
      tooltip: formatTooltip(zoomOutLabel, '-'),
      ariaLabel: zoomOutLabel,
      onClick: () => {
        model.getDesigner().zoomOut();
      },
      disabled: () => !model?.isMapLoadded(),
    },
    {
      render: () => <ZoomDisplay model={model} />,
      disabled: () => !model?.isMapLoadded(),
    },
    {
      icon: <ZoomInRoundedIcon />,
      tooltip: formatTooltip(
        intl.formatMessage({
          id: 'visualization-toolbar.tooltip-zoom-in',
          defaultMessage: 'Zoom In',
        }),
        '=',
      ),
      ariaLabel: intl.formatMessage({
        id: 'visualization-toolbar.tooltip-zoom-in',
        defaultMessage: 'Zoom In',
      }),
      onClick: () => {
        model.getDesigner().zoomIn();
      },
      disabled: () => !model?.isMapLoadded(),
    },
    // Fallback for embedded view-only modes without a top AppBar
    ...(!hasAppBar
      ? [
          undefined as ActionConfig | undefined,
          buildFindInMapConfig(model, intl, findInMap),
          buildOutlineViewConfig(model, capability, intl),
        ]
      : []),
    // Quick topic creation controls for touch and mouse editing
    ...(canEditTopics
      ? [
          undefined as ActionConfig | undefined,
          {
            icon: <AddSiblingTopicIcon />,
            tooltip: `${addSiblingLabel} (Enter)`,
            ariaLabel: addSiblingLabel,
            'data-testid': 'add-sibling-topic-button',
            onClick: () => {
              model.getDesigner().createSiblingForSelectedNode();
            },
            disabled: () =>
              !model?.isMapLoadded() || getSelectedTopicCount() !== 1 || getIsCentralSelected(),
          } as ActionConfig,
          {
            icon: <AddChildTopicIcon />,
            tooltip: `${addChildLabel} (Tab)`,
            ariaLabel: addChildLabel,
            'data-testid': 'add-child-topic-button',
            onClick: () => {
              model.getDesigner().createChildForSelectedNode();
            },
            disabled: () => !model?.isMapLoadded() || getSelectedTopicCount() !== 1,
          } as ActionConfig,
          {
            icon: <SettingsEthernetRoundedIcon />,
            tooltip: addRelationshipLabel,
            ariaLabel: addRelationshipLabel,
            'data-testid': 'add-relationship-button',
            onClick: (e) => {
              model.getDesigner().showRelPivot(e.nativeEvent);
            },
            disabled: () => !model?.isMapLoadded() || getSelectedTopicCount() === 0,
          } as ActionConfig,
        ]
      : []),
    // Separator before expand/collapse controls
    undefined as ActionConfig | undefined,
    {
      icon: nodesCollapsed ? <UnfoldMoreRoundedIcon /> : <UnfoldLessRoundedIcon />,
      tooltip: formatTooltip(
        nodesCollapsed
          ? intl.formatMessage({
              id: 'visualization-toolbar.tooltip-expand-all',
              defaultMessage: 'Expand All Nodes',
            })
          : intl.formatMessage({
              id: 'visualization-toolbar.tooltip-collapse-all',
              defaultMessage: 'Collapse All Nodes',
            }),
        'Shift+E',
      ),
      ariaLabel: nodesCollapsed
        ? intl.formatMessage({
            id: 'visualization-toolbar.tooltip-expand-all',
            defaultMessage: 'Expand All Nodes',
          })
        : intl.formatMessage({
            id: 'visualization-toolbar.tooltip-collapse-all',
            defaultMessage: 'Collapse All Nodes',
          }),
      onClick: () => {
        if (nodesCollapsed) {
          model.getDesigner().expandAllNodes();
          const maxDepth = model.getDesigner().getMindmap().getMaxDepth();
          setExpandLevel(maxDepth);
        } else {
          model.getDesigner().collapseAllNodes();
          setExpandLevel(0); // Reset to collapsed
        }
      },
      disabled: () => !model?.isMapLoadded(),
    },
    buildExpandByLevelConfig(model, intl, currentExpandLevel, setExpandLevel),
    ...(showKeyboardShortcuts
      ? [
          undefined as ActionConfig | undefined,
          {
            icon: <KeyboardRoundedIcon />,
            tooltip: intl.formatMessage({
              id: 'visualization-toolbar.tooltip-keyboard',
              defaultMessage: 'Keyboard Shortcuts',
            }),
            options: [
              {
                render: (closeModal) => <KeyboardShorcutsHelp closeModal={closeModal} />,
              },
            ],
          } as ActionConfig,
        ]
      : []),
    // Separator before theme toggle - only if theme toggle will be shown
    ...(isPublicOrEmbedded && toggleTheme ? [undefined as ActionConfig | undefined] : []),
    // Theme toggle - only for public and embedded views
    ...(isPublicOrEmbedded && toggleTheme
      ? [
          {
            icon: themeMode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />,
            tooltip:
              themeMode === 'light'
                ? intl.formatMessage({
                    id: 'visualization-toolbar.tooltip-switch-to-dark',
                    defaultMessage: 'Switch to dark mode',
                  })
                : intl.formatMessage({
                    id: 'visualization-toolbar.tooltip-switch-to-light',
                    defaultMessage: 'Switch to light mode',
                  }),
            ariaLabel: intl.formatMessage({
              id: 'visualization-toolbar.tooltip-theme-toggle',
              defaultMessage: 'Toggle theme',
            }),
            onClick: () => {
              toggleTheme();
            },
          } as ActionConfig,
        ]
      : []),
  ];
}

type VisualizationToolbarProps = {
  model: Model;
  capability: Capability;
  hasAppBar?: boolean;
};

const VisualizationToolbar = ({
  model,
  capability,
  hasAppBar = true,
}: VisualizationToolbarProps): ReactElement => {
  const intl = useIntl();
  const [expandLevel, setExpandLevel] = useState(0);
  const findInMap = useFindInMapState(model);
  const { mode, toggleMode } = useTheme();
  const selection = useSelection(model);

  const subscribeToCentralFocus = useCallback(
    (onChange: () => void): (() => void) => {
      const designer = (() => {
        try {
          return model?.getDesigner();
        } catch {
          return undefined;
        }
      })();
      if (!designer) {
        return () => undefined;
      }
      const events = ['onfocus', 'onblur', 'loadSuccess'] as const;
      events.forEach((event) => designer.addEvent(event, onChange));
      return () => {
        events.forEach((event) => designer.removeEvent(event, onChange));
      };
    },
    [model],
  );

  const isCentralFocused = useSyncExternalStore(subscribeToCentralFocus, () => {
    try {
      if (!model?.isMapLoadded()) return false;
      const designerModel = model.getDesignerModel?.();
      const central = designerModel?.getCentralTopic?.() as
        { isOnFocus?: () => boolean } | undefined;
      return Boolean(central?.isOnFocus?.());
    } catch {
      return false;
    }
  });

  useFindInMapShortcut(model, findInMap.setOpen, !hasAppBar);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Checked here (not as an effect-attach guard) because `isMapLoadded()`
      // reads mutable state on the designer, not a React-tracked value: the
      // map finishing loading never changes `model`/`expandLevel`, so an
      // attach-time guard would leave every shortcut in this handler
      // permanently dead once the map loaded after the first render.
      if (!model?.isMapLoadded()) return;

      // Share the pause that suppresses canvas shortcuts while a dialog is
      // open -- this listener sits on `document` and used to fire regardless.
      if (DesignerKeyboard.isDisabled()) return;

      const isModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;

      if (!isModifier) return;

      // Zoom (ctrl/meta with 0, -, =) is owned by DesignerKeyboard, not here.
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        if (event.shiftKey) {
          // Expand/Collapse All
          if (areNodesCollapsed(model)) {
            model.getDesigner().expandAllNodes();
            const maxDepth = model.getDesigner().getMindmap().getMaxDepth();
            setExpandLevel(maxDepth);
          } else {
            model.getDesigner().collapseAllNodes();
            setExpandLevel(0);
          }
        } else {
          // Expand by level
          handleExpandByLevel(model, expandLevel, setExpandLevel);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [model, expandLevel]);

  const config = useMemo(
    () =>
      buildVisualizationToolbarConfig(
        model,
        capability,
        intl,
        expandLevel,
        setExpandLevel,
        mode,
        toggleMode,
        findInMap,
        hasAppBar,
        selection,
        isCentralFocused,
      ),
    [
      model,
      capability,
      intl,
      expandLevel,
      mode,
      toggleMode,
      findInMap,
      hasAppBar,
      selection,
      isCentralFocused,
    ],
  );

  return (
    <Toolbar
      configurations={config}
      position={{
        position: {
          right: EDITOR_LAYOUT.zoomToolbar.rightCompact,
          bottom: EDITOR_LAYOUT.zoomToolbar.bottom,
        },
        vertical: false,
        zIndex: EDITOR_Z_INDEX.canvasChrome,
        canvasInset: 'bottom',
      }}
    />
  );
};
export default VisualizationToolbar;
