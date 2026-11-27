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

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../../../src/theme';
import { MapsListToolbar } from '../../../src/components/maps-page/maps-list/MapsListToolbar';
import { MapsPageLoading } from '../../../src/components/maps-page/maps-list/MapsListSkeleton';
import { MapCard } from '../../../src/components/maps-page/maps-list/MapCard';
import { MapRow } from '../../../src/components/maps-page/maps-list/MapRow';
import {
  FolderBreadcrumbsBar,
  FolderGridCard,
  FolderRow,
  computeVisibleBreadcrumbStart,
} from '../../../src/components/maps-page/maps-list/FolderItems';
import { useSpringValue } from '../../../src/components/maps-page/useSpringValue';
import { appleColors } from '../../../src/components/maps-page/appleDesign';
import type { Folder, MapInfo } from '../../../src/classes/client';

const SpringProbe = ({ target }: { target: number }): React.ReactElement => {
  const current = useSpringValue(target);
  return <div data-testid="spring-value">{current}</div>;
};

describe('Apple Design homepage refinements', () => {
  test('MapsListToolbar shows current filter heading, count pill, and focuses search on Cmd/Ctrl+K', () => {
    const onSearchChange = jest.fn();
    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <IntlProvider locale="en" defaultLocale="en" messages={{}}>
          <MapsListToolbar
            filter={{ type: 'starred' }}
            totalCount={4}
            selectedCount={0}
            onDeleteSelected={jest.fn()}
            onLabelSelected={jest.fn()}
            onSearchChange={onSearchChange}
          />
        </IntlProvider>
      </ThemeProvider>,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Starred');
    expect(screen.getByText('4')).toBeTruthy();

    const searchInput = screen.getByRole('textbox', { name: 'Search maps' });
    expect(document.activeElement).not.toBe(searchInput);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(searchInput);

    fireEvent.change(searchInput, { target: { value: 'chain' } });
    expect(onSearchChange).toHaveBeenCalledWith('chain');
  });

  test('MapsListToolbar switches to contextual bulk actions when maps are selected', () => {
    const onDeleteSelected = jest.fn();
    const onLabelSelected = jest.fn();

    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <IntlProvider locale="en" defaultLocale="en" messages={{}}>
          <MapsListToolbar
            filter={{ type: 'all' }}
            totalCount={5}
            selectedCount={2}
            onDeleteSelected={onDeleteSelected}
            onLabelSelected={onLabelSelected}
            onSearchChange={jest.fn()}
          />
        </IntlProvider>
      </ThemeProvider>,
    );

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    const deleteBtn = screen.getByRole('button', { name: 'Delete selected' });
    const labelBtn = screen.getByRole('button', { name: 'Add label to selected' });

    fireEvent.click(deleteBtn);
    fireEvent.click(labelBtn);
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
    expect(onLabelSelected).toHaveBeenCalledTimes(1);
    expect(within(deleteBtn).getByTestId('DeleteRoundedIcon')).toBeTruthy();
  });

  test('useSpringValue snaps immediately when prefers-reduced-motion is reduce', () => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as typeof window.matchMedia;

    const { rerender } = render(<SpringProbe target={68} />);
    expect(screen.getByTestId('spring-value').textContent).toBe('68');

    rerender(<SpringProbe target={240} />);
    expect(screen.getByTestId('spring-value').textContent).toBe('240');
  });

  test('appleColors differentiates light and dark surfaces and adheres to color-palette tokens', () => {
    const light = appleColors(false);
    const dark = appleColors(true);

    expect(light.canvas).toBe('#F2F2F7');
    expect(dark.canvas).toBe('#000000');
    expect(light.surface).toBe('#FFFFFF');
    expect(dark.surface).toBe('#1C1C1E');
    expect(light.amber).toBe('#FF9500');
    expect(dark.amber).toBe('#FF9F0A');
    expect(light.ctaPrimary).toBe('#007AFF');
    expect(dark.ctaPrimary).toBe('#0A84FF');
  });

  test('MapsPageLoading renders grid card skeletons when mapsListViewMode is grid', () => {
    localStorage.setItem('mapsListViewMode', 'grid');
    const { container } = render(
      <ThemeProvider theme={createAppTheme('light')}>
        <MapsPageLoading />
      </ThemeProvider>,
    );
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(20);
    localStorage.removeItem('mapsListViewMode');
  });

  test('MapRow renders map title link before folder path badge', () => {
    const map: MapInfo = {
      id: 42,
      title: '2.3、材料的表面处理与热处理',
      folderId: 7,
      folderPath: '第二章、非标机械设计基础',
      createdBy: 'owner',
      creationTime: '2026-01-01T00:00:00.000Z',
      lastModificationBy: 'owner',
      lastModificationTime: '2026-01-02T00:00:00.000Z',
      description: '',
      public: false,
      starred: false,
      labels: [],
      role: 'owner',
    };

    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <IntlProvider locale="en" defaultLocale="en" messages={{}}>
          <Table>
            <TableBody>
              <MapRow
                map={map}
                selected={false}
                showFolderPath={true}
                onToggleSelected={jest.fn()}
                onStar={jest.fn()}
                onOpenMenu={jest.fn()}
                onRemoveLabel={jest.fn()}
              />
            </TableBody>
          </Table>
        </IntlProvider>
      </ThemeProvider>,
    );

    const titleEl = screen.getByText('2.3、材料的表面处理与热处理');
    const folderEl = screen.getByText('第二章、非标机械设计基础');
    expect(
      titleEl.compareDocumentPosition(folderEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('FolderBreadcrumbsBar pins back button outside keyboard-scrollable trail region', () => {
    const folders: Folder[] = [
      { id: 1, name: '一级目录', parentId: null },
      { id: 2, name: '二级目录', parentId: 1 },
    ];
    const onNavigate = jest.fn();

    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <IntlProvider locale="en" defaultLocale="en" messages={{}}>
          <FolderBreadcrumbsBar folders={folders} currentFolderId={2} onNavigate={onNavigate} />
        </IntlProvider>
      </ThemeProvider>,
    );

    const backButton = screen.getByRole('button', { name: '返回上级' });
    const trailRegion = screen.getByRole('region', { name: '文件夹路径层级' });
    expect(trailRegion.getAttribute('tabindex')).toBe('0');
    expect(trailRegion.contains(backButton)).toBe(false);
    expect(within(trailRegion).getByText('根目录')).toBeTruthy();
    expect(within(trailRegion).getByText('一级目录')).toBeTruthy();
    expect(within(trailRegion).getByText('二级目录')).toBeTruthy();

    fireEvent.click(backButton);
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  test('computeVisibleBreadcrumbStart dynamically keeps 2 folders, 1 folder, or marquee for narrow widths', () => {
    // [根目录, 一级目录, 二级目录, 最里层很长目录]
    const widths = [70, 90, 95, 180];
    const sep = 23;
    const overflowBtn = 32;

    // Plenty of room -> all 4 items visible
    expect(computeVisibleBreadcrumbStart(widths, 600, sep, overflowBtn)).toEqual({
      startIndex: 0,
      marqueeLast: false,
    });

    // Enough for overflowBtn + sep + last 2 folders (95 + 23 + 180 = 298; reserved = 55)
    expect(computeVisibleBreadcrumbStart(widths, 360, sep, overflowBtn)).toEqual({
      startIndex: 2,
      marqueeLast: false,
    });

    // Enough for overflowBtn + sep + last 1 folder (180 + 55 = 235)
    expect(computeVisibleBreadcrumbStart(widths, 240, sep, overflowBtn)).toEqual({
      startIndex: 3,
      marqueeLast: false,
    });

    // Too narrow even for the innermost folder -> show innermost with marquee
    expect(computeVisibleBreadcrumbStart(widths, 180, sep, overflowBtn)).toEqual({
      startIndex: 3,
      marqueeLast: true,
    });
  });

  test('FolderBreadcrumbsBar collapses leading crumbs into Windows-style dropdown menu when constrained', () => {
    const folders: Folder[] = [
      { id: 1, name: '第一章、基础', parentId: null },
      { id: 2, name: '第二章、非标机械设计基础', parentId: 1 },
    ];
    const onNavigate = jest.fn();

    const originalClientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    );
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if ((this as HTMLElement).getAttribute?.('aria-label') === '文件夹路径层级') {
          return 230;
        }
        return 0;
      },
    });
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const text = this.textContent?.trim() ?? '';
      let width = 32;
      if (text === '根目录') width = 70;
      else if (text === '第一章、基础') width = 100;
      else if (text === '第二章、非标机械设计基础') width = 170;
      else if (this.tagName === 'SPAN') width = 15;
      return {
        width,
        height: 32,
        top: 0,
        left: 0,
        right: width,
        bottom: 32,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });

    try {
      render(
        <ThemeProvider theme={createAppTheme('light')}>
          <IntlProvider locale="en" defaultLocale="en" messages={{}}>
            <FolderBreadcrumbsBar folders={folders} currentFolderId={2} onNavigate={onNavigate} />
          </IntlProvider>
        </ThemeProvider>,
      );

      const trailRegion = screen.getByRole('region', { name: '文件夹路径层级' });
      // Only the innermost folder stays inline; 根目录 and 第一章、基础 move into the dropdown
      expect(within(trailRegion).queryByText('根目录')).toBeNull();
      expect(within(trailRegion).queryByText('第一章、基础')).toBeNull();
      expect(within(trailRegion).getByText('第二章、非标机械设计基础')).toBeTruthy();

      const overflowButton = within(trailRegion).getByRole('button', {
        name: '展开上级文件夹路径',
      });
      fireEvent.click(overflowButton);

      const rootMenuItem = screen.getByRole('menuitem', { name: '根目录' });
      expect(screen.getByRole('menuitem', { name: '第一章、基础' })).toBeTruthy();
      fireEvent.click(rootMenuItem);
      expect(onNavigate).toHaveBeenCalledWith(null);
    } finally {
      jest.restoreAllMocks();
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('FolderGridCard uses layered folder SVG icon only in grid view while FolderRow keeps Material symbol', () => {
    const folder: Folder = {
      id: 3,
      name: '第二章、非标机械设计基础',
      parentId: null,
    };

    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <IntlProvider locale="en" defaultLocale="en" messages={{}}>
          <FolderGridCard
            folder={folder}
            onOpenFolder={jest.fn()}
            onOpenMenu={jest.fn()}
            onContextMenu={jest.fn()}
          />
          <Table>
            <TableBody>
              <FolderRow
                folder={folder}
                onOpenFolder={jest.fn()}
                onOpenMenu={jest.fn()}
                onContextMenu={jest.fn()}
              />
            </TableBody>
          </Table>
        </IntlProvider>
      </ThemeProvider>,
    );

    const gridCard = screen.getByTestId('folder-grid-card-3');
    const rowEl = screen.getByRole('row');
    expect(within(gridCard).getByTestId('folder-grid-svg-icon')).toBeTruthy();
    expect(within(rowEl).queryByTestId('folder-grid-svg-icon')).toBeNull();
  });

  test('MapCard groups star and settings actions on the right and keeps card content shrinkable on narrow screens', () => {
    const sampleMap: MapInfo = {
      id: 11,
      title: '2.4、机械零件设计公差与配合（超长标题测试）',
      description: '',
      createdBy: 'owner@example.com',
      creationTime: '2026-01-01T00:00:00Z',
      lastModificationBy: 'owner@example.com',
      lastModificationTime: '2026-01-02T00:00:00Z',
      starred: false,
      public: false,
      labels: [],
      role: 'owner',
      sizeBytes: 50278,
    };

    const { container } = render(
      <ThemeProvider theme={createAppTheme('light')}>
        <IntlProvider locale="en" defaultLocale="en" messages={{}}>
          <MapCard
            map={sampleMap}
            selected={false}
            onToggleSelected={jest.fn()}
            onStar={jest.fn()}
            onOpenMenu={jest.fn()}
          />
        </IntlProvider>
      </ThemeProvider>,
    );

    expect(container.querySelector('.MuiCardHeader-avatar')).toBeNull();
    const actionSlot = container.querySelector('.MuiCardHeader-action') as HTMLElement;
    expect(actionSlot).toBeTruthy();
    expect(within(actionSlot).getByRole('button', { name: 'Starred' })).toBeTruthy();
    expect(within(actionSlot).getByRole('button', { name: 'Settings' })).toBeTruthy();

    const contentSlot = container.querySelector('.MuiCardHeader-content') as HTMLElement;
    expect(['0', '0px']).toContain(getComputedStyle(contentSlot).minWidth);

    // Verify CompactCardHeader injects an override rule centering .MuiCardHeader-action
    const injectedCss = Array.from(document.querySelectorAll('style'))
      .flatMap((style) =>
        style.sheet ? Array.from(style.sheet.cssRules).map((rule) => rule.cssText) : [],
      )
      .join('\n');
    expect(injectedCss).toMatch(/\.MuiCardHeader-action\s*\{[^}]*align-self:\s*center/);
  });
});
