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

import { act, fireEvent, screen, waitFor } from '@testing-library/react';

const mockExportFile = jest.fn(() =>
  Promise.resolve({
    blob: new Blob(['xmind-bytes'], { type: 'application/vnd.xmind.workbook' }),
    extension: 'xmind',
    mimeType: 'application/vnd.xmind.workbook',
  }),
);
const mockExporter = { exportFile: () => mockExportFile() };
const mockCreateTextExporter = jest.fn(
  (_type: string, _mindmap: unknown, _mapName?: string) => mockExporter,
);
jest.mock('@wisemapping/editor', () => ({
  TextExporterFactory: {
    create: (type: string, mindmap: unknown, mapName?: string) =>
      mockCreateTextExporter(type, mindmap, mapName),
  },
  sanitizeExportFileName: (name: string | undefined, fallback = 'mindmap') =>
    (name ?? '').trim().replace(/[\\/:*?"<>|]/g, '_') || fallback,
}));

const mockFetchMindmap = jest.fn();
jest.mock('../../../src/components/editor-page/PersistenceManagerUtils', () => ({
  fetchMindmap: (mapId: number) => mockFetchMindmap(mapId),
}));

import type { Designer } from '@wisemapping/editor';
import ExportDialog from '../../../src/components/maps-page/action-dispatcher/export-dialog';
import Client from '../../../src/classes/client';
import { renderWithProviders } from '../helpers/render';
import { defined } from '../defined';

const mockFetchMapMetadata = jest.fn(() => Promise.resolve({ title: 'Map' }));
const client = {
  fetchMapMetadata: mockFetchMapMetadata,
} as unknown as Client;

const fakeMindmap = (name: string, theme = 'prism') => {
  const mindmap = {
    name,
    theme,
    getId: () => name,
    getTheme: () => mindmap.theme,
    setTheme: jest.fn((value: string) => {
      mindmap.theme = value;
    }),
  };
  return mindmap;
};

const fakeDesigner = (name: string, theme = 'classic') => {
  const mindmap = fakeMindmap(name, theme);
  const applyTheme = jest.fn((value: string) => mindmap.setTheme(value));
  return {
    mindmap,
    applyTheme,
    designer: {
      getMindmap: () => mindmap,
      applyTheme,
    } as unknown as Designer,
  };
};

const submit = (): void => {
  fireEvent.submit(screen.getByRole('button', { name: 'Export' }).closest('form')!);
};

describe('ExportDialog', () => {
  const globalWithDesigner = globalThis as unknown as { designer?: Designer };

  beforeEach(() => {
    jest.clearAllMocks();
    globalWithDesigner.designer = fakeDesigner('other map').designer;
    URL.createObjectURL = jest.fn(() => 'blob:export');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    delete globalWithDesigner.designer;
  });

  test('exports the map of its own editor without mutating the live map theme', async () => {
    const own = fakeDesigner('own map', 'classic');
    const onClose = jest.fn();
    renderWithProviders(
      <ExportDialog mapId={1} enableImgExport={true} designer={own.designer} onClose={onClose} />,
      { client },
    );

    submit();

    await waitFor(() => expect(mockCreateTextExporter).toHaveBeenCalled());
    expect(defined(mockCreateTextExporter.mock.calls[0])[0]).toBe('xmind');
    expect(defined(mockCreateTextExporter.mock.calls[0])[1]).toBe(own.mindmap);
    expect(own.applyTheme).not.toHaveBeenCalled();
    expect(own.mindmap.getTheme()).toBe('classic');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
  });

  test('from the map list, fetches the selected map and defaults to XMind', async () => {
    const selected = fakeMindmap('selected map');
    mockFetchMindmap.mockResolvedValue(selected);
    const downloads: string[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    renderWithProviders(<ExportDialog mapId={7} enableImgExport={false} onClose={jest.fn()} />, {
      client,
    });
    await waitFor(() => expect(mockFetchMapMetadata).toHaveBeenCalledWith(7));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    submit();

    await waitFor(() => expect(downloads).toEqual(['Map.xmind']));
    expect(mockFetchMindmap).toHaveBeenCalledWith(7);
    expect(mockCreateTextExporter).toHaveBeenCalledWith('xmind', selected, 'Map');
    click.mockRestore();
  });

  test('downloads Markdown export as .zip when images are bundled', async () => {
    mockFetchMindmap.mockResolvedValue(fakeMindmap('selected map'));
    mockExportFile.mockResolvedValueOnce({
      blob: new Blob(['zip-bytes'], { type: 'application/zip' }),
      extension: 'zip',
      mimeType: 'application/zip',
    });
    const downloads: string[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    renderWithProviders(<ExportDialog mapId={7} enableImgExport={false} onClose={jest.fn()} />, {
      client,
    });
    await waitFor(() => expect(mockFetchMapMetadata).toHaveBeenCalledWith(7));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    fireEvent.click(screen.getByRole('radio', { name: 'Markdown (.md / .zip)' }));
    submit();

    await waitFor(() => expect(downloads).toEqual(['Map.zip']));
    expect(defined(mockCreateTextExporter.mock.calls[0])[0]).toBe('md');
    click.mockRestore();
  });

  test('keeps the dialog open and shows an error when image download or export fails', async () => {
    const own = fakeDesigner('own map');
    const onClose = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockExportFile.mockRejectedValueOnce(new Error('图片下载失败 (HTTP 404)'));

    renderWithProviders(
      <ExportDialog mapId={1} enableImgExport={true} designer={own.designer} onClose={onClose} />,
      { client },
    );

    submit();

    await waitFor(() => expect(screen.getByText('图片下载失败 (HTTP 404)')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
