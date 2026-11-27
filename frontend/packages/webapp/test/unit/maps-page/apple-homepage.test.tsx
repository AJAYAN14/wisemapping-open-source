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
import { MapRow } from '../../../src/components/maps-page/maps-list/MapRow';
import {
  FolderBreadcrumbsBar,
  FolderGridCard,
  FolderRow,
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
          <FolderBreadcrumbsBar
            folders={folders}
            currentFolderId={2}
            onNavigate={onNavigate}
          />
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
});
