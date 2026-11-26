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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppBar from '../../../src/components/app-bar';
import Capability from '../../../src/classes/action/capability';
import type Editor from '../../../src/classes/model/editor';
import type MapInfo from '../../../src/classes/model/map-info';
import { Providers } from '../cov-core/helpers';

jest.mock('@wisemapping/mindplot', () => ({
  $notify: jest.fn(),
  isMacPlatform: () => false,
  StrokeStyle: { SOLID: 'solid', DASHED: 'dashed', DOTTED: 'dotted' },
  LineType: {},
}));

const createInteractiveModel = () => {
  const listeners: Record<string, (() => void)[]> = {};
  const selectionState = { topics: 0, relationships: 0 };
  const topic = {
    getId: () => 5,
    isCentralTopic: () => false,
    getFontFamily: () => 'Arial',
    getLinkValue: () => undefined,
    getNoteValue: () => undefined,
    getImageUrl: () => undefined,
    getImageSize: () => undefined,
    getModel: () => ({ getShapeType: () => 'rectangle', getConnectionStyle: () => undefined }),
  };
  const designerModel = {
    selectedTopic: () => (selectionState.topics > 0 ? topic : undefined),
    selectedRelationship: () => (selectionState.relationships > 0 ? {} : undefined),
    filterSelectedTopics: () => Array.from({ length: selectionState.topics }, () => topic),
    filterSelectedRelationships: () =>
      Array.from({ length: selectionState.relationships }, () => ({})),
    countSelectedTopics: () => selectionState.topics,
    countSelectedRelationships: () => selectionState.relationships,
    getCentralTopic: () => ({
      getId: () => 1,
      getText: () => 'Central',
      getModel: () => ({ getPlainText: () => 'Central' }),
      getChildren: () => [],
    }),
  };
  const designer = {
    undo: jest.fn(),
    redo: jest.fn(),
    deleteSelectedEntities: jest.fn(),
    addEvent: jest.fn((type: string, l: () => void) => {
      listeners[type] = [...(listeners[type] ?? []), l];
    }),
    removeEvent: jest.fn((type: string, l: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((x) => x !== l);
    }),
    getModel: () => designerModel,
    getMindmap: () => ({ getTheme: () => 'prism', getCanvasStyle: () => ({}) }),
    getLayout: () => 'mindmap',
    changeTheme: jest.fn(),
    changeLayout: jest.fn(),
  };
  const model = {
    isMapLoadded: () => true,
    getDesigner: () => designer,
    getDesignerModel: () => designerModel,
    save: jest.fn((): Promise<void> => Promise.resolve()),
  } as unknown as Editor;

  const fire = (type: string) =>
    act(() => {
      (listeners[type] ?? []).forEach((l) => l());
    });

  return { model, designer, topic, selectionState, fire };
};

const createMapInfo = (): MapInfo =>
  ({
    getTitle: () => 'My Map',
    isStarred: jest.fn(() => new Promise<boolean>(() => undefined)),
    updateStarred: jest.fn(() => Promise.resolve()),
    updateTitle: jest.fn(() => Promise.resolve()),
    isLocked: () => false,
    getId: () => '1',
  }) as unknown as MapInfo;

describe('AppBar contextual formatting', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    jest.clearAllMocks();
  });

  it('shows formatting controls in the center of desktop AppBar only when selected, without remounting Find in Map', () => {
    const { model, selectionState, fire } = createInteractiveModel();
    render(
      <Providers>
        <AppBar
          model={model}
          mapInfo={createMapInfo()}
          capability={new Capability('edition-owner', false)}
          onAction={jest.fn()}
        />
      </Providers>,
    );

    expect(screen.queryByTestId('appbar-context-formatting')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('find-in-map-button'));
    expect(screen.getByTestId('find-in-map-panel')).toBeInTheDocument();

    selectionState.topics = 1;
    fire('onfocus');

    const ctxGroup = screen.getByTestId('appbar-context-formatting');
    expect(ctxGroup).toHaveAttribute('role', 'group');
    expect(within(ctxGroup).getByRole('button', { name: 'Font Style' })).toBeEnabled();
    expect(within(ctxGroup).getByRole('button', { name: 'Add Topic Image' })).toBeEnabled();
    expect(within(ctxGroup).getByRole('button', { name: /Add Note/ })).toBeEnabled();
    expect(within(ctxGroup).getByRole('button', { name: /Add Link/ })).toBeEnabled();
    const deleteBtn = within(ctxGroup).getByTestId('appbar-delete-topic-button');
    expect(deleteBtn).toBeEnabled();
    expect(
      within(ctxGroup).queryByRole('button', { name: 'Relationship Style' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('find-in-map-panel')).toBeInTheDocument();

    fireEvent.click(deleteBtn);
    expect(model.getDesigner().deleteSelectedEntities).toHaveBeenCalledTimes(1);

    selectionState.topics = 0;
    selectionState.relationships = 1;
    fire('onfocus');

    const relGroup = screen.getByTestId('appbar-context-formatting');
    expect(within(relGroup).getByRole('button', { name: 'Relationship Style' })).toBeEnabled();
    expect(within(relGroup).queryByRole('button', { name: 'Font Style' })).not.toBeInTheDocument();

    selectionState.relationships = 0;
    fire('onblur');
    expect(screen.queryByTestId('appbar-context-formatting')).not.toBeInTheDocument();
  });

  it('keeps contextual formatting out of AppBar on compact viewports (< md) and in viewer mode', () => {
    const { model, selectionState } = createInteractiveModel();
    selectionState.topics = 1;

    const { unmount } = render(
      <Providers>
        <AppBar
          model={model}
          mapInfo={createMapInfo()}
          capability={new Capability('edition-viewer', false)}
          onAction={jest.fn()}
        />
      </Providers>,
    );
    expect(screen.queryByTestId('appbar-context-formatting')).not.toBeInTheDocument();
    unmount();

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as typeof window.matchMedia;

    render(
      <Providers>
        <AppBar
          model={model}
          mapInfo={createMapInfo()}
          capability={new Capability('edition-owner', false)}
          onAction={jest.fn()}
        />
      </Providers>,
    );
    expect(screen.queryByTestId('appbar-context-formatting')).not.toBeInTheDocument();
  });

  it('omits the delete button in AppBar when only the central topic is selected', () => {
    const { model, topic, selectionState } = createInteractiveModel();
    topic.isCentralTopic = () => true;
    selectionState.topics = 1;

    render(
      <Providers>
        <AppBar
          model={model}
          mapInfo={createMapInfo()}
          capability={new Capability('edition-owner', false)}
          onAction={jest.fn()}
        />
      </Providers>,
    );

    const ctxGroup = screen.getByTestId('appbar-context-formatting');
    expect(within(ctxGroup).queryByTestId('appbar-delete-topic-button')).not.toBeInTheDocument();
  });
});
