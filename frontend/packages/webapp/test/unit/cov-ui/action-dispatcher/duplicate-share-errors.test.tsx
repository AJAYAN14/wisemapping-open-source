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

import { fireEvent, screen, waitFor } from '@testing-library/react';

const mockUseFetchMapById = jest.fn();
jest.mock('../../../../src/classes/middleware', () => ({
  useFetchMapById: (id: number) => mockUseFetchMapById(id),
}));

import DuplicateDialog from '../../../../src/components/maps-page/action-dispatcher/duplicate-dialog';
import Client, { MapInfo } from '../../../../src/classes/client';
import { renderWithProviders } from '../../helpers/render';

const map = (title: string): MapInfo => ({
  id: 4,
  title,
  description: 'About it',
  starred: false,
  labels: [],
  createdBy: '',
  creationTime: '',
  lastModificationBy: '',
  lastModificationTime: '',
  public: false,
  role: 'owner',
});

describe('DuplicateDialog errors', () => {
  const setup = (mapId: number, title = 'Original') => {
    mockUseFetchMapById.mockReturnValue({ isLoading: false, error: undefined, data: map(title) });
    const duplicateMap = jest.fn<Promise<number>, [number, unknown]>(() => Promise.resolve(5));
    const onClose = jest.fn();
    renderWithProviders(<DuplicateDialog mapId={mapId} onClose={onClose} />, {
      client: { duplicateMap } as unknown as Client,
    });
    return { duplicateMap, onClose };
  };

  test('a map without a title can not be duplicated', async () => {
    const { duplicateMap } = setup(4, '   ');

    expect(await screen.findByText('Map title is required and cannot be empty')).toBeTruthy();
    expect(duplicateMap).not.toHaveBeenCalled();
  });

  test('an invalid map id is refused on submit', async () => {
    const { duplicateMap } = setup(Number.NaN);

    fireEvent.submit(screen.getByRole('button', { name: 'Duplicate' }).closest('form')!);

    expect(await screen.findByText('Invalid map ID')).toBeTruthy();
    expect(duplicateMap).not.toHaveBeenCalled();
  });

  test('typing clears a previous error', async () => {
    const { duplicateMap } = setup(4);
    duplicateMap.mockRejectedValue({ msg: 'Quota exceeded' });
    const title = await screen.findByDisplayValue('Copy of Original');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByText('Quota exceeded')).toBeTruthy();

    fireEvent.change(title, { target: { value: 'Second copy' } });

    await waitFor(() => expect(screen.queryByText('Quota exceeded')).toBeNull());
  });
});
