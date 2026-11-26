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

/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DeleteConfirmEvent } from '@wisemapping/mindplot';
import Editor from '../../../src/components';
import Capability from '../../../src/classes/action/capability';
import type Model from '../../../src/classes/model/editor';
import type MapInfo from '../../../src/classes/model/map-info';
import type { EditorConfiguration } from '../../../src/hooks/useEditor';
import { createThemeStorage } from './helpers';

jest.mock('@wisemapping/mindplot', () => ({
  WidgetBuilder: class {
    addHander = jest.fn();
  },
  DesignerKeyboard: {
    pause: jest.fn(),
    resume: jest.fn(),
    isDisabled: () => false,
  },
}));

jest.mock('../../../src/components/app-bar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../src/components/editor-toolbar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../src/components/visualization-toolbar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../src/hooks/useCanvasViewportInsets', () => ({
  useCanvasViewportInsets: jest.fn(),
}));

describe('Editor deleteConfirm integration', () => {
  it('opens ConfirmDeleteDialog on designer deleteConfirm events for all selection shapes', () => {
    const listeners: Record<string, Array<(payload: unknown) => void>> = {};
    const designer = {
      initializeThemeVariant: jest.fn(),
      setThemeVariant: jest.fn(),
      getWidgetManager: () => ({ addHander: jest.fn() }),
      addEvent: jest.fn((type: string, fn: (payload: unknown) => void) => {
        listeners[type] = [...(listeners[type] ?? []), fn];
      }),
      removeEvent: jest.fn((type: string, fn: (payload: unknown) => void) => {
        listeners[type] = (listeners[type] ?? []).filter((item) => item !== fn);
      }),
    };
    const model = {
      isMapLoadded: () => true,
      getDesigner: () => designer,
    } as unknown as Model;
    const mapInfo = {
      getTitle: () => 'Map',
      isLocked: () => false,
    } as unknown as MapInfo;
    const config: EditorConfiguration = {
      model,
      mindplotRef: { current: null },
      mapInfo,
      capability: new Capability('edition-owner', false),
      options: {
        mode: 'edition-owner',
        locale: 'en',
        enableKeyboardEvents: true,
        enableAppBar: false,
      },
    };

    render(
      <Editor config={config} onAction={jest.fn()} themeVariantStorage={createThemeStorage()} />,
    );

    const fireDeleteConfirm = (payload: DeleteConfirmEvent) => {
      act(() => {
        (listeners['deleteConfirm'] ?? []).forEach((fn) => fn(payload));
      });
    };

    const confirmTopic = jest.fn();
    fireDeleteConfirm({
      topicCount: 1,
      relationshipCount: 0,
      hasChildren: false,
      topicTitles: ['Leaf'],
      confirm: confirmTopic,
    });
    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Leaf/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete-cancel'));
    expect(confirmTopic).not.toHaveBeenCalled();

    const confirmWithChildren = jest.fn();
    fireDeleteConfirm({
      topicCount: 1,
      relationshipCount: 0,
      hasChildren: true,
      topicTitles: ['Branch'],
      confirm: confirmWithChildren,
    });
    expect(screen.getByText(/Branch/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete-submit'));
    expect(confirmWithChildren).toHaveBeenCalledTimes(1);

    const confirmUntitledWithChildren = jest.fn();
    fireDeleteConfirm({
      topicCount: 1,
      relationshipCount: 0,
      hasChildren: true,
      topicTitles: [],
      confirm: confirmUntitledWithChildren,
    });
    fireEvent.click(screen.getByTestId('confirm-delete-cancel'));

    const confirmUntitledLeaf = jest.fn();
    fireDeleteConfirm({
      topicCount: 1,
      relationshipCount: 0,
      hasChildren: false,
      topicTitles: [],
      confirm: confirmUntitledLeaf,
    });
    fireEvent.click(screen.getByTestId('confirm-delete-cancel'));

    const confirmMultiWithChildren = jest.fn();
    fireDeleteConfirm({
      topicCount: 3,
      relationshipCount: 0,
      hasChildren: true,
      topicTitles: ['A', 'B', 'C'],
      confirm: confirmMultiWithChildren,
    });
    fireEvent.click(screen.getByTestId('confirm-delete-cancel'));

    const confirmMulti = jest.fn();
    fireDeleteConfirm({
      topicCount: 2,
      relationshipCount: 0,
      hasChildren: false,
      topicTitles: ['A', 'B'],
      confirm: confirmMulti,
    });
    fireEvent.click(screen.getByTestId('confirm-delete-cancel'));

    const confirmRel = jest.fn();
    fireDeleteConfirm({
      topicCount: 0,
      relationshipCount: 1,
      hasChildren: false,
      topicTitles: [],
      confirm: confirmRel,
    });
    fireEvent.click(screen.getByTestId('confirm-delete-submit'));
    expect(confirmRel).toHaveBeenCalledTimes(1);
  });
});
