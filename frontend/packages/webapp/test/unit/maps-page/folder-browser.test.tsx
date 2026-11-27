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

import { useState } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import type { Folder, MapInfo } from '../../../src/classes/client';
import type { Filter } from '../../../src/components/maps-page';
import { MAP_IDS_DRAG_MIME } from '../../../src/components/maps-page/folderTree';
import { MapsList } from '../../../src/components/maps-page/maps-list';
import { renderWithWrapper } from '../cov-pages/providers';

jest.mock('../../../src/components/maps-page/action-dispatcher', () => ({
  __esModule: true,
  default: () => null,
}));

const makeMap = (overrides: Partial<MapInfo> & { id: number; title: string }): MapInfo => ({
  description: '',
  starred: false,
  labels: [],
  createdBy: 'owner@example.com',
  creationTime: '2026-01-01T00:00:00Z',
  lastModificationBy: 'owner@example.com',
  lastModificationTime: '2026-01-01T00:00:00Z',
  public: false,
  role: 'owner',
  ...overrides,
});

const folders: Folder[] = [
  { id: 1, name: '第二章', parentId: null },
  { id: 2, name: '2.1 小节', parentId: 1 },
];

const maps: MapInfo[] = [
  makeMap({ id: 101, title: '根目录导图', folderId: null }),
  makeMap({ id: 102, title: '机械零件', folderId: 1, folderPath: '第二章/' }),
  makeMap({ id: 103, title: '子目录导图', folderId: 2, folderPath: '第二章/2.1 小节/' }),
];

const Harness = ({
  initialFilter = { type: 'all' },
  onCreateFolder = jest.fn(),
  onRenameFolder = jest.fn(),
  onMoveFolder = jest.fn(),
  onDeleteFolder = jest.fn(),
  onDropMapsToFolder = jest.fn(),
}: {
  initialFilter?: Filter;
  onCreateFolder?: (parentId: number | null) => void;
  onRenameFolder?: (folder: Folder) => void;
  onMoveFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  onDropMapsToFolder?: (mapIds: number[], folderId: number | null) => void;
}) => {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  return (
    <MapsList
      filter={filter}
      folders={folders}
      onFilterChange={setFilter}
      onCreateFolder={onCreateFolder}
      onRenameFolder={onRenameFolder}
      onMoveFolder={onMoveFolder}
      onDeleteFolder={onDeleteFolder}
      onDropMapsToFolder={onDropMapsToFolder}
    />
  );
};

describe('Main workspace folder browser & segmented switcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('switches between 全部导图 and 文件夹 tabs and drills down with breadcrumbs', async () => {
    const client = {
      fetchAllMaps: jest.fn().mockResolvedValue(maps),
      updateStarred: jest.fn().mockResolvedValue(undefined),
    };
    renderWithWrapper(<Harness />, { client });

    await screen.findByText('根目录导图');
    expect(screen.getByText('机械零件')).toBeTruthy();

    const folderTab = screen.getByRole('tab', { name: /文件夹/ });
    fireEvent.click(folderTab);

    // Folder root shows top-level folders and root maps only.
    expect(screen.getByTestId('folder-row-1')).toBeTruthy();
    expect(screen.getByText('根目录导图')).toBeTruthy();
    expect(screen.queryByText('机械零件')).toBeNull();
    expect(screen.queryByTestId('folder-row-2')).toBeNull();

    // Enter 第二章 -> shows subfolder 2.1 小节 and direct map 机械零件, plus breadcrumbs.
    fireEvent.click(screen.getByTestId('folder-row-1'));
    expect(screen.getByTestId('folder-row-2')).toBeTruthy();
    expect(screen.getByText('机械零件')).toBeTruthy();
    expect(screen.queryByText('根目录导图')).toBeNull();
    expect(screen.getByLabelText('文件夹路径')).toBeTruthy();

    // Return to root via breadcrumb.
    fireEvent.click(screen.getByRole('button', { name: '根目录' }));
    expect(screen.getByTestId('folder-row-1')).toBeTruthy();
    expect(screen.getByText('根目录导图')).toBeTruthy();
  });

  test('clicking folder path badge in 全部导图 jumps directly to that folder', async () => {
    const client = {
      fetchAllMaps: jest.fn().mockResolvedValue(maps),
      updateStarred: jest.fn().mockResolvedValue(undefined),
    };
    renderWithWrapper(<Harness />, { client });

    await screen.findByText('机械零件');
    fireEvent.click(screen.getByRole('button', { name: '第二章/' }));

    expect(screen.getByLabelText('文件夹路径')).toBeTruthy();
    expect(screen.getByText('机械零件')).toBeTruthy();
    expect(screen.queryByText('根目录导图')).toBeNull();
  });

  test('folder row menu triggers create, rename, move, and delete handlers', async () => {
    const onCreateFolder = jest.fn();
    const onRenameFolder = jest.fn();
    const onMoveFolder = jest.fn();
    const onDeleteFolder = jest.fn();

    const client = {
      fetchAllMaps: jest.fn().mockResolvedValue(maps),
      updateStarred: jest.fn().mockResolvedValue(undefined),
    };
    renderWithWrapper(
      <Harness
        initialFilter={{ type: 'folder', folderId: null }}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onMoveFolder={onMoveFolder}
        onDeleteFolder={onDeleteFolder}
      />,
      { client },
    );

    await screen.findByTestId('folder-row-1');
    fireEvent.click(screen.getByRole('button', { name: '操作文件夹 第二章' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '新建子文件夹' }));
    expect(onCreateFolder).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: '操作文件夹 第二章' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '重命名文件夹' }));
    expect(onRenameFolder).toHaveBeenCalledWith(folders[0]);

    fireEvent.click(screen.getByRole('button', { name: '操作文件夹 第二章' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '移动到...' }));
    expect(onMoveFolder).toHaveBeenCalledWith(folders[0]);

    fireEvent.click(screen.getByRole('button', { name: '操作文件夹 第二章' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '删除文件夹' }));
    expect(onDeleteFolder).toHaveBeenCalledWith(folders[0]);
  });

  test('dropping maps onto a folder row or breadcrumb chip calls onDropMapsToFolder', async () => {
    const onDropMapsToFolder = jest.fn();
    const client = {
      fetchAllMaps: jest.fn().mockResolvedValue(maps),
      updateStarred: jest.fn().mockResolvedValue(undefined),
    };
    renderWithWrapper(
      <Harness
        initialFilter={{ type: 'folder', folderId: null }}
        onDropMapsToFolder={onDropMapsToFolder}
      />,
      { client },
    );

    const folderRow = await screen.findByTestId('folder-row-1');
    const dragData = {
      types: [MAP_IDS_DRAG_MIME],
      dropEffect: 'none',
      getData: (mime: string) => (mime === MAP_IDS_DRAG_MIME ? '[101]' : ''),
    };

    fireEvent.dragOver(folderRow, { dataTransfer: dragData });
    fireEvent.drop(folderRow, { dataTransfer: dragData });
    expect(onDropMapsToFolder).toHaveBeenCalledWith([101], 1);

    // Drill into folder 1 and drop onto 根目录 breadcrumb.
    fireEvent.click(folderRow);
    const rootCrumb = within(screen.getByLabelText('文件夹路径')).getByRole('button', {
      name: '根目录',
    });
    const backDragData = {
      types: [MAP_IDS_DRAG_MIME],
      dropEffect: 'none',
      getData: (mime: string) => (mime === MAP_IDS_DRAG_MIME ? '[102]' : ''),
    };
    fireEvent.dragOver(rootCrumb, { dataTransfer: backDragData });
    fireEvent.drop(rootCrumb, { dataTransfer: backDragData });
    expect(onDropMapsToFolder).toHaveBeenCalledWith([102], null);
  });
});
