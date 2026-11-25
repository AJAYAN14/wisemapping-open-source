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
import { ReactElement, useState, useEffect, useMemo } from 'react';
import { IntlShape, useIntl } from 'react-intl';
import ActionConfig from '../../classes/action/action-config';
import Capability from '../../classes/action/capability';
import Editor from '../../classes/model/editor';
import Model from '../../classes/model/editor';
import KeyboardShorcutsHelp from '../action-widget/pane/keyboard-shortcut-help';
import OutlineViewDialog from '../action-widget/pane/outline-view-dialog';
import FindInMapPanel from '../action-widget/pane/find-in-map';
import { DesignerKeyboard, isMacPlatform } from '@wisemapping/mindplot';
import Toolbar from '../toolbar';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import TocRoundedIcon from '@mui/icons-material/TocRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { handleExpandByLevel, buildExpandByLevelConfig } from './expand-by-level-icon';
import { formatTooltip } from './utils';
import { EDITOR_LAYOUT, EDITOR_Z_INDEX } from '../../theme/layout';
import ZoomDisplay from './zoom-display';
import { useTheme } from '../../contexts/ThemeContext';

// Helper function to check if any nodes are currently collapsed
const areNodesCollapsed = (model: Editor): boolean => {
  if (!model?.isMapLoadded()) return false;
  const allTopics = model.getDesigner().getModel().getTopics();
  return allTopics.some(
    (topic) => topic.getType() !== 'CentralTopic' && topic.areChildrenShrunken(),
  );
};

export type FindInMapState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function buildVisualizationToolbarConfig(
  model: Editor,
  capability: Capability,
  intl: IntlShape,
  currentExpandLevel: number,
  setExpandLevel: (level: number) => void,
  themeMode?: 'light' | 'dark',
  toggleTheme?: () => void,
  findInMap?: FindInMapState,
): (ActionConfig | undefined)[] {
  const zoomToFitLabel = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-zoom-to-fit',
    defaultMessage: 'Zoom to Fit',
  });
  const zoomOutLabel = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-zoom-out',
    defaultMessage: 'Zoom Out',
  });

  // Check if we're in public or embedded view
  const isPublicOrEmbedded =
    capability.mode === 'viewonly-public' || capability.mode === 'viewonly-private';

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
    // Separator between zoom controls and outline view
    undefined as ActionConfig | undefined,
    {
      icon: <SearchRoundedIcon />,
      tooltip: formatTooltip(
        intl.formatMessage({
          id: 'visualization-toolbar.tooltip-find-in-map',
          defaultMessage: 'Find in Map',
        }),
        'F',
      ),
      ariaLabel: intl.formatMessage({
        id: 'visualization-toolbar.tooltip-find-in-map',
        defaultMessage: 'Find in Map',
      }),
      'data-testid': 'find-in-map-button',
      ...(findInMap && { open: findInMap.open, onOpenChange: findInMap.setOpen }),
      options: [
        {
          render: (closeModal) => (
            <FindInMapPanel designer={model.getDesigner()} closeModal={closeModal} />
          ),
        },
      ],
      disabled: () => !model?.isMapLoadded(),
    },
    // Separator between find and outline view
    undefined as ActionConfig | undefined,
    {
      icon: <TocRoundedIcon />,
      tooltip: formatTooltip(
        intl.formatMessage({
          id: 'visualization-toolbar.tooltip-outline-view',
          defaultMessage: 'Outline View',
        }),
        'O',
      ),
      ariaLabel: intl.formatMessage({
        id: 'visualization-toolbar.tooltip-outline-view',
        defaultMessage: 'Outline View',
      }),
      options: [
        {
          render: (closeModal) => (
            <OutlineViewDialog
              open={true}
              onClose={closeModal}
              mindmap={model.getDesigner()?.getMindmap()}
            />
          ),
        },
      ],
      disabled: () => !model?.isMapLoadded(),
    },
    // Separator between outline view and expand/collapse controls
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
    // Separator between expand controls and keyboard shortcuts
    undefined as ActionConfig | undefined,
    {
      icon: <KeyboardRoundedIcon />,
      tooltip: intl.formatMessage({
        id: 'visualization-toolbar.tooltip-keyboard',
        defaultMessage: 'Keyboard Shortcuts',
      }),
      visible: !capability.isHidden('keyboard-shortcuts'),
      options: [
        {
          render: (closeModal) => <KeyboardShorcutsHelp closeModal={closeModal} />,
        },
      ],
    },
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
};

const VisualizationToolbar = ({ model, capability }: VisualizationToolbarProps): ReactElement => {
  const intl = useIntl();
  const [expandLevel, setExpandLevel] = useState(0);
  const [findInMapOpen, setFindInMapOpen] = useState(false);
  const { mode, toggleMode } = useTheme();

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
      switch (event.key.toLowerCase()) {
        case 'f':
          event.preventDefault();
          setFindInMapOpen(true);
          break;
        case 'e':
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
          break;
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
        { open: findInMapOpen, setOpen: setFindInMapOpen },
      ),
    [model, capability, intl, expandLevel, mode, toggleMode, findInMapOpen],
  );

  // Check if we're in public or embedded view
  const isPublicOrEmbedded =
    capability.mode === 'viewonly-public' || capability.mode === 'viewonly-private';

  return (
    <Toolbar
      configurations={config}
      position={{
        position: {
          right: isPublicOrEmbedded
            ? EDITOR_LAYOUT.zoomToolbar.rightCompact
            : EDITOR_LAYOUT.zoomToolbar.right,
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
