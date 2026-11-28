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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  { id: 3, name: '目标文件夹', parentId: null },
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

  test('multi-selects folders without opening them and moves them to another folder', async () => {
    const nestedFolders: Folder[] = [
      { id: 10, name: 'XMind', parentId: null },
      { id: 11, name: '第一章', parentId: 10 },
      { id: 12, name: '第二章', parentId: 10 },
      { id: 13, name: '汇总目录', parentId: null },
    ];
    const moveFoldersToFolder = jest.fn().mockResolvedValue(undefined);
    const client = {
      fetchAllMaps: jest.fn().mockResolvedValue(maps),
      updateStarred: jest.fn().mockResolvedValue(undefined),
      moveFoldersToFolder,
    };

    const MultiHarness = () => {
      const [filter, setFilter] = useState<Filter>({ type: 'folder', folderId: 10 });
      return <MapsList filter={filter} folders={nestedFolders} onFilterChange={setFilter} />;
    };

    renderWithWrapper(<MultiHarness />, { client });

    await screen.findByTestId('folder-row-11');

    // Selecting folder checkboxes must NOT navigate into the folders.
    fireEvent.click(screen.getByRole('checkbox', { name: '选择文件夹 第一章' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择文件夹 第二章' }));
    expect(screen.getByTestId('folder-row-11')).toBeTruthy();
    expect(screen.getByTestId('folder-row-12')).toBeTruthy();

    // Folders-only selection hides "Add Label" and shows Move + Delete.
    expect(screen.queryByRole('button', { name: 'Add label to selected' })).toBeNull();
    expect(screen.getByRole('button', { name: '删除选中文件夹' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '将选中文件夹移动到其他文件夹' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/已选择 2 个文件夹/)).toBeTruthy();

    // Moving folders themselves are disabled as destinations to prevent cycles.
    expect(
      within(dialog).getByRole('option', { name: '第一章' }).getAttribute('aria-disabled'),
    ).toBe('true');

    fireEvent.click(within(dialog).getByRole('option', { name: '汇总目录' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '移动到此处' }));

    await waitFor(() => expect(moveFoldersToFolder).toHaveBeenCalledWith([11, 12], 13));
  });

  test('select-all in folder view selects both folders and maps and moves both', async () => {
    const moveFoldersToFolder = jest.fn().mockResolvedValue(undefined);
    const moveMapsToFolder = jest.fn().mockResolvedValue(undefined);
    const client = {
      fetchAllMaps: jest.fn().mockResolvedValue(maps),
      updateStarred: jest.fn().mockResolvedValue(undefined),
      moveFoldersToFolder,
      moveMapsToFolder,
    };

    const MixedHarness = () => {
      const [filter, setFilter] = useState<Filter>({ type: 'folder', folderId: null });
      return <MapsList filter={filter} folders={folders} onFilterChange={setFilter} />;
    };

    renderWithWrapper(<MixedHarness />, { client });

    await screen.findByTestId('folder-row-1');
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement;
    fireEvent.click(selectAllCheckbox);
    expect(selectAllCheckbox.checked).toBe(true);
    expect(
      (screen.getByRole('checkbox', { name: '选择文件夹 第二章' }) as HTMLInputElement).checked,
    ).toBe(true);

    // Mixed selection shows Move button and hides Delete/Add Label.
    expect(screen.queryByRole('button', { name: 'Delete selected' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add label to selected' })).toBeNull();

    // Unselect 目标文件夹 (id=3) so we can move 第二章 + 根目录导图 into 目标文件夹.
    fireEvent.click(screen.getByRole('checkbox', { name: '选择文件夹 目标文件夹' }));
    expect(selectAllCheckbox.checked).toBe(false);
    expect(selectAllCheckbox.getAttribute('data-indeterminate')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '将选中项目移动到文件夹' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/已选择 1 个文件夹、1 份导图/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('option', { name: '目标文件夹' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '移动到此处' }));

    await waitFor(() => expect(moveFoldersToFolder).toHaveBeenCalledWith([1], 3));
    await waitFor(() => expect(moveMapsToFolder).toHaveBeenCalledWith([101], 3));
  });

  test('supports folder checkboxes in grid view without opening the folder', async () => {
    const client = {
      fetchAllMaps: jest.fn().mockResolvedValue(maps),
      updateStarred: jest.fn().mockResolvedValue(undefined),
    };
    renderWithWrapper(<Harness initialFilter={{ type: 'folder', folderId: null }} />, { client });

    await screen.findByTestId('folder-row-1');
    fireEvent.click(screen.getByRole('button', { name: '栅格视图' }));
    expect(await screen.findByTestId('folder-grid-card-1')).toBeTruthy();

    const folderCheckbox = screen.getByRole('checkbox', { name: '选择文件夹 第二章' }) as HTMLInputElement;
    fireEvent.click(folderCheckbox);
    expect(folderCheckbox.checked).toBe(true);
    // Must stay at folder root rather than drilling into 第二章.
    expect(screen.getByTestId('folder-grid-card-3')).toBeTruthy();
    expect(screen.getByRole('button', { name: '将选中文件夹移动到其他文件夹' })).toBeTruthy();
  });
});
