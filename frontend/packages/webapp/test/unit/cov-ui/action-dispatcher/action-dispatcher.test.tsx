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
import { fireEvent, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

// Each dialog is replaced by a marker naming it and the props it was given: this suite is about
// which dialog the dispatcher opens for which action.
type MarkerProps = {
  mapId?: number;
  mapsId?: number[];
  onClose: (success?: boolean) => void;
};
const mockMarker = (name: string) =>
  function Marker({ mapId, mapsId, onClose }: MarkerProps): React.ReactElement {
    return (
      <button type="button" onClick={() => onClose(true)}>
        {`${name} ${JSON.stringify({ mapId, mapsId })}`}
      </button>
    );
  };
jest.mock('../../../../src/components/maps-page/action-dispatcher/create-dialog', () =>
  mockMarker('create'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/delete-dialog', () =>
  mockMarker('delete'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/delete-multiselect-dialog', () =>
  mockMarker('delete-multi'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/rename-dialog', () =>
  mockMarker('rename'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/duplicate-dialog', () =>
  mockMarker('duplicate'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/history-dialog', () =>
  mockMarker('history'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/export-dialog', () =>
  mockMarker('export'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/label-dialog', () =>
  mockMarker('label'),
);
jest.mock('../../../../src/components/maps-page/action-dispatcher/move-folder-dialog', () =>
  mockMarker('move-folder'),
);

import ActionDispatcher, {
  handleOnMutationSuccess,
} from '../../../../src/components/maps-page/action-dispatcher';
import { ActionType } from '../../../../src/components/maps-page/action-chooser';
import { renderWithProviders } from '../../helpers/render';

const dispatch = (
  action: ActionType,
  mapsId: number[] = [5],
  extra: { pageMode?: 'edit' | 'view-private' } = {},
) => {
  const onClose = jest.fn();
  const view = renderWithProviders(
    <ActionDispatcher
      action={action}
      mapsId={mapsId}
      onClose={onClose}
      {...(extra.pageMode !== undefined && { pageMode: extra.pageMode })}
    />,
  );
  return { onClose, view };
};

describe('ActionDispatcher', () => {
  test.each([
    ['create', [5], 'create {}'],
    ['rename', [5], 'rename {"mapId":5}'],
    ['duplicate', [5], 'duplicate {"mapId":5}'],
    ['history', [5], 'history {"mapId":5}'],
    ['export', [5], 'export {"mapId":5}'],
    ['label', [5, 6], 'label {"mapsId":[5,6]}'],
    ['move-folder', [5, 6], 'move-folder {"mapsId":[5,6]}'],
    ['delete', [5], 'delete {"mapId":5}'],
    ['delete', [5, 6], 'delete-multi {"mapsId":[5,6]}'],
  ] as [ActionType, number[], string][])('"%s" on %j opens %s', async (action, mapsId, marker) => {
    dispatch(action, mapsId);

    expect((await screen.findByRole('button')).textContent).toBe(marker);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  test("a dialog's result is passed on to onClose", async () => {
    const { onClose } = dispatch('rename', [5]);
    fireEvent.click(await screen.findByRole('button'));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  test('no action renders nothing', () => {
    const { onClose, view } = dispatch(undefined);
    expect(view.container.textContent).toBe('');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('open goes to the editor at once, without a dialog', () => {
    const { onClose, view } = dispatch('open', [5]);
    expect(onClose).toHaveBeenCalledWith(true);
    expect(view.container.textContent).toBe('');
  });

  test('back closes cleanly without a dialog', () => {
    const { onClose, view } = dispatch('back', [5], { pageMode: 'edit' });
    expect(onClose).toHaveBeenCalledWith(true);
    expect(view.container.textContent).toBe('');
  });
});

describe('handleOnMutationSuccess', () => {
  test('refreshes the map list and closes', () => {
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const onClose = jest.fn();

    handleOnMutationSuccess(onClose, queryClient);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['maps'] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
