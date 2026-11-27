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
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../../../src/theme';
import { MapsListToolbar } from '../../../src/components/maps-page/maps-list/MapsListToolbar';
import { MapsPageLoading } from '../../../src/components/maps-page/maps-list/MapsListSkeleton';
import { useSpringValue } from '../../../src/components/maps-page/useSpringValue';
import { appleColors } from '../../../src/components/maps-page/appleDesign';

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

  test('appleColors differentiates light and dark surfaces and preserves amber accent', () => {
    const light = appleColors(false);
    const dark = appleColors(true);

    expect(light.canvas).not.toBe(dark.canvas);
    expect(light.sidebarGlass).not.toBe(dark.sidebarGlass);
    expect(light.amber).toBe('#F59E0B');
    expect(dark.amber).toBe('#FF9F0A');
    expect(light.ctaPrimary).toBe('#18181B');
    expect(dark.ctaPrimary).toBe('#F4F4F5');
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
});
