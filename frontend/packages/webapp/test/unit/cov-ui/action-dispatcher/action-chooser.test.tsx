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

import { fireEvent, screen } from '@testing-library/react';

import ActionChooser from '../../../../src/components/maps-page/action-chooser';
import { renderWithProviders } from '../../helpers/render';

const ALL = [
  'Open',
  'Duplicate',
  'Rename',
  'Add Label',
  '移动到文件夹',
  'Delete',
  'Export',
  'History',
];

const setup = (open = true) => {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const onClose = jest.fn();
  renderWithProviders(
    <ActionChooser mapId={9} onClose={onClose} anchor={open ? anchor : undefined} />,
  );
  return onClose;
};

const items = (): string[] => screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');

describe('ActionChooser', () => {
  test('renders every available map action', () => {
    setup();
    expect(items()).toEqual(ALL);
  });

  test.each([
    ['Open', 'open'],
    ['Duplicate', 'duplicate'],
    ['Rename', 'rename'],
    ['Add Label', 'label'],
    ['移动到文件夹', 'move-folder'],
    ['Delete', 'delete'],
    ['Export', 'export'],
    ['History', 'history'],
  ])('choosing "%s" reports the %s action', (label, action) => {
    const onClose = setup();

    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(onClose).toHaveBeenCalledWith(action);
  });

  test('dismissing the menu reports no action', () => {
    const onClose = setup();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledWith(undefined);
  });

  test('without an anchor the menu is closed', () => {
    setup(false);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
