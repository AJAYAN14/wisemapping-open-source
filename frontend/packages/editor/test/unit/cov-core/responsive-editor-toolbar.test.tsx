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
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditorToolbar from '../../../src/components/editor-toolbar';
import { ToolbarMenuItem } from '../../../src/components/toolbar';
import Capability from '../../../src/classes/action/capability';
import type ActionConfig from '../../../src/classes/action/action-config';
import type Editor from '../../../src/classes/model/editor';
import { Providers } from './helpers';

jest.mock('@wisemapping/mindplot', () => ({
  $notify: jest.fn(),
  isMacPlatform: () => false,
  StrokeStyle: { SOLID: 'solid', DASHED: 'dashed', DOTTED: 'dotted' },
  LineType: {},
}));

const mockMatchMedia = (matchesQuery: (query: string) => boolean) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: matchesQuery(query),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

const createEditorModel = (options: {
  topicCount: number;
  relationshipCount?: number;
  centralOnly?: boolean;
}) => {
  const topic = {
    getId: () => (options.centralOnly ? 0 : 2),
    isCentralTopic: () => Boolean(options.centralOnly),
    getFontFamily: () => 'Arial',
    getLinkValue: () => undefined,
    getNoteValue: () => undefined,
    getImageEmojiChar: () => undefined,
    getImageGalleryIconName: () => undefined,
    getModel: () => ({ getShapeType: () => 'rectangle', getConnectionStyle: () => undefined }),
  };

  const designerModel = {
    selectedTopic: () => (options.topicCount > 0 ? topic : undefined),
    selectedRelationship: () => ((options.relationshipCount ?? 0) > 0 ? {} : undefined),
    filterSelectedTopics: () => Array.from({ length: options.topicCount }, () => topic),
    filterSelectedRelationships: () =>
      Array.from({ length: options.relationshipCount ?? 0 }, () => ({})),
    countSelectedTopics: () => options.topicCount,
    countSelectedRelationships: () => options.relationshipCount ?? 0,
  };

  const designer = {
    getModel: () => designerModel,
    getThemeVariant: () => 'light',
    getMindmap: () => ({ getCanvasStyle: () => ({}) }),
    setCanvasStyle: jest.fn(),
    showRelPivot: jest.fn(),
    editSelectedTopic: jest.fn(),
    deleteSelectedEntities: jest.fn(),
    addEvent: jest.fn(),
    removeEvent: jest.fn(),
  };

  const model = {
    isMapLoadded: () => true,
    getDesigner: () => designer,
    getDesignerModel: () => designerModel,
  } as unknown as Editor;

  return { model, designer };
};

describe('Responsive EditorToolbar & Touch Submenu', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    jest.clearAllMocks();
  });

  it('toggles submenu open and closed on click, and ignores hover after touchstart', () => {
    const config: ActionConfig = {
      icon: <span>icon</span>,
      tooltip: 'Style',
      options: [{ icon: <span>item</span>, tooltip: 'Item', onClick: jest.fn() }],
    };

    render(
      <Providers>
        <ToolbarMenuItem configuration={config} />
      </Providers>,
    );

    const item = screen.getByRole('menuitem');
    const trigger = screen.getByRole('button', { name: 'Style', hidden: true });

    // Touch input suppresses hover-open so tap handles state cleanly.
    fireEvent.touchStart(item);
    fireEvent.mouseEnter(item);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides EditorToolbar on narrow screens when nothing is selected', () => {
    mockMatchMedia((q) => q.includes('max-width:599.95') || q.includes('max-width: 599.95'));
    const { model } = createEditorModel({ topicCount: 0, relationshipCount: 0 });

    render(
      <Providers>
        <EditorToolbar model={model} capability={new Capability('edition-owner', false)} />
      </Providers>,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders a bottom horizontal context dock with Edit and Delete on narrow screens when a topic is selected', () => {
    mockMatchMedia((q) => q.includes('max-width:599.95') || q.includes('max-width: 599.95'));
    const { model, designer } = createEditorModel({ topicCount: 1, centralOnly: false });

    render(
      <Providers>
        <EditorToolbar model={model} capability={new Capability('edition-owner', false)} />
      </Providers>,
    );

    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('aria-orientation', 'horizontal');
    expect(menu).toHaveAttribute('data-canvas-inset', 'bottom');

    fireEvent.click(screen.getByTestId('mobile-edit-topic-button'));
    expect(designer.editSelectedTopic).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('mobile-delete-topic-button'));
    expect(designer.deleteSelectedEntities).toHaveBeenCalledTimes(1);
  });

  it('omits the Delete action on narrow screens when only the central topic is selected', () => {
    mockMatchMedia((q) => q.includes('max-width:599.95') || q.includes('max-width: 599.95'));
    const { model } = createEditorModel({ topicCount: 1, centralOnly: true });

    render(
      <Providers>
        <EditorToolbar model={model} capability={new Capability('edition-owner', false)} />
      </Providers>,
    );

    expect(screen.getByTestId('mobile-edit-topic-button')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-delete-topic-button')).not.toBeInTheDocument();
  });

  it('renders the vertical right formatting toolbar on desktop screens', () => {
    mockMatchMedia(() => false);
    const { model } = createEditorModel({ topicCount: 0 });

    render(
      <Providers>
        <EditorToolbar model={model} capability={new Capability('edition-owner', false)} />
      </Providers>,
    );

    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('aria-orientation', 'vertical');
    expect(menu).toHaveAttribute('data-canvas-inset', 'right');
  });
});
