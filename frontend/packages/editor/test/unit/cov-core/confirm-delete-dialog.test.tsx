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
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider } from 'react-intl';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import ConfirmDeleteDialog from '../../../src/components/confirm-delete-dialog';

const pause = jest.fn();
const resume = jest.fn();

jest.mock('@wisemapping/mindplot', () => ({
  DesignerKeyboard: {
    pause: () => pause(),
    resume: () => resume(),
  },
}));

const renderDialog = (
  props: Partial<React.ComponentProps<typeof ConfirmDeleteDialog>> = {},
  mode: 'light' | 'dark' = 'light',
) => {
  const onConfirm = props.onConfirm ?? jest.fn();
  const onCancel = props.onCancel ?? jest.fn();
  const view = render(
    <IntlProvider locale="en" messages={{}}>
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <ConfirmDeleteDialog
          open={props.open ?? true}
          title={props.title ?? 'Delete topic?'}
          message={props.message ?? 'Are you sure?'}
          onConfirm={onConfirm}
          onCancel={onCancel}
          confirmLabel={props.confirmLabel}
          cancelLabel={props.cancelLabel}
        />
      </ThemeProvider>
    </IntlProvider>,
  );
  return { ...view, onConfirm, onCancel };
};

describe('ConfirmDeleteDialog', () => {
  beforeEach(() => {
    pause.mockClear();
    resume.mockClear();
  });

  it('renders nothing when closed and pauses/resumes DesignerKeyboard when open', () => {
    const { rerender } = renderDialog({ open: false });
    expect(screen.queryByTestId('confirm-delete-dialog')).toBeNull();
    expect(pause).not.toHaveBeenCalled();

    rerender(
      <IntlProvider locale="en" messages={{}}>
        <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
          <ConfirmDeleteDialog
            open={true}
            title="Delete topic?"
            message="Are you sure?"
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        </ThemeProvider>
      </IntlProvider>,
    );
    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    expect(pause).toHaveBeenCalledTimes(1);

    rerender(
      <IntlProvider locale="en" messages={{}}>
        <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
          <ConfirmDeleteDialog
            open={false}
            title="Delete topic?"
            message="Are you sure?"
            onConfirm={jest.fn()}
            onCancel={jest.fn()}
          />
        </ThemeProvider>
      </IntlProvider>,
    );
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('confirms and cancels in jsdom fallback mode and stops keydown bubbling', () => {
    const parentKeyDown = jest.fn();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    render(
      <div onKeyDown={parentKeyDown}>
        <IntlProvider locale="en" messages={{}}>
          <ThemeProvider theme={createTheme({ palette: { mode: 'light' } })}>
            <ConfirmDeleteDialog
              open={true}
              title="Delete topic?"
              message="Are you sure?"
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          </ThemeProvider>
        </IntlProvider>
      </div>,
    );

    const dialog = screen.getByTestId('confirm-delete-dialog');
    expect(dialog).not.toHaveAttribute('role');
    expect(dialog).not.toHaveAttribute('aria-modal');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(parentKeyDown).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-delete-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('confirm-delete-submit'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses native showModal/close and returnValue when supported and closes on outside pointer fallback', () => {
    const originalShowModal = HTMLDialogElement.prototype.showModal;
    const originalClose = HTMLDialogElement.prototype.close;

    HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = jest.fn(function (
      this: HTMLDialogElement,
      returnValue?: string,
    ) {
      if (returnValue !== undefined) {
        this.returnValue = returnValue;
      }
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    });

    try {
      const { onConfirm, onCancel, unmount } = renderDialog();
      const dialog = screen.getByTestId('confirm-delete-dialog') as HTMLDialogElement;
      expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);

      dialog.getBoundingClientRect = () =>
        ({ left: 100, right: 300, top: 100, bottom: 250 }) as DOMRect;

      // Outside click closes with empty returnValue -> onCancel
      dialog.dispatchEvent(
        Object.assign(new Event('pointerdown', { bubbles: true }), { clientX: 10, clientY: 10 }),
      );
      dialog.dispatchEvent(
        Object.assign(new Event('pointerup', { bubbles: true }), { clientX: 10, clientY: 10 }),
      );
      expect(onCancel).toHaveBeenCalledTimes(1);

      // Re-open attribute and test close with confirm returnValue
      dialog.setAttribute('open', '');
      dialog.close('confirm');
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(dialog.returnValue).toBe('');

      unmount();
    } finally {
      HTMLDialogElement.prototype.showModal = originalShowModal;
      HTMLDialogElement.prototype.close = originalClose;
    }
  });
});
