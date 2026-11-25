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

import { useEffect } from 'react';
import { IntlShape } from 'react-intl';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TocRoundedIcon from '@mui/icons-material/TocRounded';
import { DesignerKeyboard, isMacPlatform } from '@wisemapping/mindplot';
import ActionConfig from '../../classes/action/action-config';
import Capability from '../../classes/action/capability';
import Editor from '../../classes/model/editor';
import FindInMapPanel from '../action-widget/pane/find-in-map';
import OutlineViewDialog from '../action-widget/pane/outline-view-dialog';
import { formatTooltip } from './utils';

export type FindInMapState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * Shared ActionConfig for "Find in Map", mounted in AppBar by default and kept
 * in VisualizationToolbar only when AppBar is disabled (e.g. embedded view-only).
 */
export function buildFindInMapConfig(
  model: Editor | undefined,
  intl: IntlShape,
  findInMap?: FindInMapState,
): ActionConfig {
  const label = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-find-in-map',
    defaultMessage: 'Find in Map',
  });

  return {
    icon: <SearchRoundedIcon />,
    tooltip: formatTooltip(label, 'F'),
    ariaLabel: label,
    'data-testid': 'find-in-map-button',
    ...(findInMap && { open: findInMap.open, onOpenChange: findInMap.setOpen }),
    options: [
      {
        render: (closeModal) =>
          model ? (
            <FindInMapPanel designer={model.getDesigner()} closeModal={closeModal} />
          ) : (
            <></>
          ),
      },
    ],
    disabled: () => !model?.isMapLoadded(),
  };
}

/**
 * Shared ActionConfig for "Outline View", mounted in AppBar by default and kept
 * in VisualizationToolbar only when AppBar is disabled.
 */
export function buildOutlineViewConfig(
  model: Editor | undefined,
  capability: Capability,
  intl: IntlShape,
): ActionConfig {
  const label = intl.formatMessage({
    id: 'visualization-toolbar.tooltip-outline-view',
    defaultMessage: 'Outline View',
  });

  return {
    icon: <TocRoundedIcon />,
    tooltip: formatTooltip(label, 'O'),
    ariaLabel: label,
    'data-testid': 'outline-view-button',
    visible: !capability.isHidden('outline-view'),
    options: [
      {
        render: (closeModal) =>
          model ? (
            <OutlineViewDialog
              open={true}
              onClose={closeModal}
              mindmap={model.getDesigner()?.getMindmap()}
            />
          ) : (
            <></>
          ),
      },
    ],
    disabled: () => !model?.isMapLoadded(),
  };
}

/**
 * Attaches Ctrl+F / Cmd+F to open the Find in Map popover when this toolbar
 * owns the search trigger.
 */
export function useFindInMapShortcut(
  model: Editor | undefined,
  setOpen: (open: boolean) => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!model?.isMapLoadded()) return;
      if (DesignerKeyboard.isDisabled()) return;

      const isModifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
      if (!isModifier) return;

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [model, setOpen, enabled]);
}
