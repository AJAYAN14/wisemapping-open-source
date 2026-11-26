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
import { fireEvent, screen } from '@testing-library/react';
import { StrokeStyle } from '@wisemapping/mindplot';
import RelationshipStyleEditor from '../../../src/components/action-widget/pane/relationship-style-editor';
import { property, readOnlyProperty, renderPane } from './helpers';

const relationshipModels = () => ({
  strokeStyleModel: property<StrokeStyle>(StrokeStyle.DASHED),
  startArrowModel: property<boolean>(false),
  endArrowModel: property<boolean>(true),
  colorModel: property<string | undefined>(undefined),
});

describe('RelationshipStyleEditor', () => {
  it.each([
    ['Solid Line', StrokeStyle.SOLID],
    ['Dashed Line', StrokeStyle.DASHED],
    ['Dotted Line', StrokeStyle.DOTTED],
  ])('sets the %s stroke', (label, style) => {
    const m = relationshipModels();
    renderPane(<RelationshipStyleEditor closeModal={jest.fn()} {...m} />);

    fireEvent.click(screen.getByRole('button', { name: label }));

    expect(m.strokeStyleModel.setValue).toHaveBeenCalledWith(style);
  });

  it('flips each arrow from its current state', () => {
    const m = relationshipModels();
    renderPane(<RelationshipStyleEditor closeModal={jest.fn()} {...m} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Arrow' }));
    fireEvent.click(screen.getByRole('button', { name: 'End Arrow' }));

    expect(m.startArrowModel.setValue).toHaveBeenCalledWith(true);
    expect(m.endArrowModel.setValue).toHaveBeenCalledWith(false);
  });

  it('sets and clears the relationship colour', () => {
    const m = relationshipModels();
    renderPane(<RelationshipStyleEditor closeModal={jest.fn()} {...m} />);

    fireEvent.click(screen.getByRole('button', { name: '#ff0000' }));
    fireEvent.click(screen.getByRole('button', { name: 'Default color' }));

    expect(m.colorModel.setValue.mock.calls).toEqual([['#ff0000'], [undefined]]);
  });

  it('closes from the close button', () => {
    const closeModal = jest.fn();
    renderPane(<RelationshipStyleEditor closeModal={closeModal} {...relationshipModels()} />);

    fireEvent.click(screen.getByTestId('CloseRoundedIcon').closest('button') as HTMLElement);

    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks on models that cannot be changed', () => {
    renderPane(
      <RelationshipStyleEditor
        closeModal={jest.fn()}
        strokeStyleModel={readOnlyProperty(StrokeStyle.SOLID)}
        startArrowModel={readOnlyProperty(true)}
        endArrowModel={readOnlyProperty(false)}
        colorModel={readOnlyProperty<string | undefined>('#000000')}
      />,
    );

    for (const name of ['Solid Line', 'Dashed Line', 'Dotted Line', 'Start Arrow', 'End Arrow']) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(screen.getByRole('button', { name: 'Solid Line' })).toBeTruthy();
  });
});
