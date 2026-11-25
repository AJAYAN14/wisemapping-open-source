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
    blob: new Blob(['data'], { type: 'application/vnd.xmind.workbook' }),
    extension: 'xmind',
    mimeType: 'application/vnd.xmind.workbook',
  }),
);
const mockExporter = { exportFile: () => mockExportFile() };
const mockCreateTextExporter = jest.fn((..._args: unknown[]) => mockExporter);
jest.mock('@wisemapping/editor', () => ({
  TextExporterFactory: { create: (...args: unknown[]) => mockCreateTextExporter(...args) },
  sanitizeExportFileName: (name: string | undefined, fallback = 'mindmap') =>
    (name ?? '').trim().replace(/[\\/:*?"<>|]/g, '_') || fallback,
}));
const mockFetchMindmap = jest.fn();
jest.mock('../../../../src/components/editor-page/PersistenceManagerUtils', () => ({
  fetchMindmap: (mapId: number) => mockFetchMindmap(mapId),
}));

import ExportDialog from '../../../../src/components/maps-page/action-dispatcher/export-dialog';
import Client from '../../../../src/classes/client';
import { renderWithProviders } from '../../helpers/render';

const mockFetchMapMetadata = jest.fn(() => Promise.resolve({ title: 'Plan' }));
const client = { fetchMapMetadata: mockFetchMapMetadata } as unknown as Client;

const fakeMindmap = (id = 'plan') => ({
  getId: () => id,
  getTheme: () => 'prism',
  setTheme: jest.fn(),
});

const submit = (): void => {
  fireEvent.submit(screen.getByRole('button', { name: 'Export' }).closest('form')!);
};

const radio = (name: string): HTMLInputElement =>
  screen.getByRole('radio', { name }) as HTMLInputElement;

describe('ExportDialog options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:export');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  test('offers only XMind and Markdown options with XMind selected by default', () => {
    renderWithProviders(<ExportDialog mapId={3} enableImgExport={false} onClose={jest.fn()} />, {
      client,
    });

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(radio('XMind (.xmind)').checked).toBe(true);
    expect(radio('Markdown (.md / .zip)').checked).toBe(false);
    expect(screen.queryByText(/SVG,PNG,JPEG,PDF/)).toBeNull();
  });

  test('switching to Markdown downloads a .md file when there are no images', async () => {
    const mindmap = fakeMindmap();
    mockFetchMindmap.mockResolvedValue(mindmap);
    mockExportFile.mockResolvedValueOnce({
      blob: new Blob(['# Plan\n'], { type: 'text/markdown' }),
      extension: 'md',
      mimeType: 'text/markdown',
    });
    const downloads: string[] = [];
    jest.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(`${this.download} ${this.href}`);
    });
    const onClose = jest.fn();
    renderWithProviders(<ExportDialog mapId={3} enableImgExport={false} onClose={onClose} />, {
      client,
    });
    await waitFor(() => expect(mockFetchMapMetadata).toHaveBeenCalledWith(3));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    fireEvent.click(radio('Markdown (.md / .zip)'));
    submit();

    await waitFor(() => expect(downloads).toEqual(['Plan.md blob:export']));
    expect(mockCreateTextExporter).toHaveBeenCalledWith('md', mindmap, 'Plan');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
    expect(onClose).toHaveBeenCalledWith(true);
  });

  test('cancel closes without exporting', () => {
    const onClose = jest.fn();
    renderWithProviders(<ExportDialog mapId={3} enableImgExport={false} onClose={onClose} />, {
      client,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockFetchMindmap).not.toHaveBeenCalled();
  });
});
