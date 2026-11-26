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
import { IntlProvider } from 'react-intl';
import AppBar from '../../../src/components/app-bar';
import Capability from '../../../src/classes/action/capability';
import type Editor from '../../../src/classes/model/editor';
import type MapInfo from '../../../src/classes/model/map-info';
import { EditorThemeProvider } from '../../../src/contexts/ThemeContext';
import { createThemeStorage } from './helpers';

jest.mock('../../../src/components/app-bar/styles.css', () => '');

jest.mock('@wisemapping/mindplot', () => ({
  $notify: jest.fn(),
  isMacPlatform: () => false,
}));

describe('AppBar mobile overflow menu', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders rounded frosted menu paper with accessible attributes and actions on compact viewports', () => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as typeof window.matchMedia;

    const designer = {
      addEvent: jest.fn(),
      removeEvent: jest.fn(),
      getModel: () => ({
        filterSelectedTopics: () => [],
        filterSelectedRelationships: () => [],
        isTopicSelected: () => false,
      }),
      getMindmap: () => ({ getTheme: () => 'prism' }),
      undo: jest.fn(),
      redo: jest.fn(),
    };
    const model = {
      isMapLoadded: () => true,
      getDesigner: () => designer,
      save: jest.fn(() => Promise.resolve()),
    } as unknown as Editor;
    const mapInfo = {
      getTitle: () => 'Mobile Map',
      isLocked: () => false,
      isStarred: () => Promise.resolve(false),
      updateStarred: jest.fn(() => Promise.resolve()),
    } as unknown as MapInfo;
    const onAction = jest.fn();

    render(
      <IntlProvider locale="en" messages={{}}>
        <EditorThemeProvider themeVariantStorage={createThemeStorage('light')}>
          <AppBar
            model={model}
            mapInfo={mapInfo}
            capability={new Capability('edition-owner', false)}
            onAction={onAction}
          />
        </EditorThemeProvider>
      </IntlProvider>,
    );

    const moreButton = screen.getByTestId('app-bar-more-button');
    expect(moreButton).toHaveAttribute('aria-haspopup', 'menu');
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    expect(moreButton).toHaveAttribute('aria-controls', 'app-bar-overflow-menu');

    const paper = screen.getByTestId('app-bar-overflow-menu-paper');
    expect(window.getComputedStyle(paper).borderRadius).toBe('16px');
    expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', 'app-bar-more-button');
    expect(screen.getByText('Changes History')).toBeInTheDocument();
    expect(screen.getByText('Starred')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Toggle Theme')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Export'));
    expect(onAction).toHaveBeenCalledWith('export');
  });
});
