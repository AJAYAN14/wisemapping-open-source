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
import React, { ReactElement, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { styled, useTheme } from '@mui/material/styles';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { DesignerKeyboard } from '@wisemapping/mindplot';
import { appleFontStack, getFrostedGlassCard } from '../../theme/appleDesign';

export type ConfirmDeleteDialogProps = {
  open: boolean;
  title: React.ReactNode;
  message: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

const NativeConfirmDialog = styled('dialog')(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  const glass = getFrostedGlassCard(theme, '18px');

  return {
    padding: 0,
    margin: 'auto',
    width: 'min(400px, calc(100dvw - 32px))',
    maxWidth: 'calc(100dvw - 32px)',
    border: glass.border as string,
    borderRadius: '18px',
    backgroundColor: isDark ? 'rgba(32, 32, 36, 0.88)' : 'rgba(255, 255, 255, 0.90)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isDark
      ? '0 24px 48px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)'
      : '0 24px 48px -12px rgba(16, 24, 40, 0.22), 0 0 0 1px rgba(16, 24, 40, 0.06)',
    color: theme.palette.text.primary,
    fontFamily: appleFontStack,
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    '&[open]': {
      display: 'flex',
      flexDirection: 'column',
    },
    '&::backdrop': {
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.56)' : 'rgba(15, 23, 42, 0.34)',
      backdropFilter: 'blur(3px)',
      WebkitBackdropFilter: 'blur(3px)',
      overflow: 'hidden',
      overscrollBehavior: 'contain',
    },
    '@media (prefers-reduced-transparency: reduce), (prefers-contrast: more)': {
      backgroundColor: theme.palette.background.paper,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
    '@media (prefers-reduced-motion: no-preference)': {
      '&[open]': {
        animation: 'confirm-dialog-in 160ms cubic-bezier(0.2, 0, 0, 1) both',
      },
      '@keyframes confirm-dialog-in': {
        from: {
          opacity: 0,
          transform: 'scale(0.96) translateY(4px)',
        },
        to: {
          opacity: 1,
          transform: 'scale(1) translateY(0)',
        },
      },
    },
    '@media (forced-colors: active)': {
      backgroundColor: 'Canvas',
      color: 'CanvasText',
      borderColor: 'ButtonBorder',
    },
  };
});

const DialogBody = styled('div')({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '14px',
  padding: '22px 22px 16px',
});

const IconBadge = styled('div')(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
    color: isDark ? '#f87171' : '#dc2626',
  };
});

const TextColumn = styled('div')({
  minWidth: 0,
  flex: 1,
});

const DialogTitle = styled('h1')(({ theme }) => ({
  margin: 0,
  fontSize: '1.05rem',
  fontWeight: 600,
  lineHeight: 1.35,
  color: theme.palette.text.primary,
  fontFamily: appleFontStack,
}));

const DialogMessage = styled('p')(({ theme }) => ({
  margin: '6px 0 0',
  fontSize: '0.88rem',
  lineHeight: 1.5,
  color: theme.palette.text.secondary,
  wordBreak: 'break-word',
  fontFamily: appleFontStack,
}));

const ActionsRow = styled('div')(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '12px 22px 18px',
    borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
  };
});

const ActionButton = styled('button', {
  shouldForwardProp: (prop) => prop !== 'tone',
})<{ tone: 'cancel' | 'danger' }>(({ theme, tone }) => {
  const isDark = theme.palette.mode === 'dark';
  const isDanger = tone === 'danger';

  return {
    appearance: 'none',
    border: isDanger
      ? 'none'
      : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)'}`,
    borderRadius: '11px',
    minHeight: '38px',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: 600,
    fontFamily: appleFontStack,
    cursor: 'pointer',
    backgroundColor: isDanger
      ? isDark
        ? '#ef4444'
        : '#dc2626'
      : isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.04)',
    color: isDanger ? '#ffffff' : theme.palette.text.primary,
    transition: 'background-color 140ms ease, transform 120ms cubic-bezier(0.2, 0, 0, 1)',
    '&:hover': {
      backgroundColor: isDanger
        ? isDark
          ? '#dc2626'
          : '#b91c1c'
        : isDark
          ? 'rgba(255, 255, 255, 0.14)'
          : 'rgba(0, 0, 0, 0.08)',
    },
    '&:active': {
      transform: 'scale(0.97)',
    },
    '&:focus-visible': {
      outline: `2px solid ${isDanger ? (isDark ? '#fca5a5' : '#b91c1c') : theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
    '@media (pointer: coarse)': {
      minHeight: '44px',
      padding: '10px 18px',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:active': {
        transform: 'none',
      },
    },
    '@media (forced-colors: active)': {
      border: '1px solid ButtonBorder',
      backgroundColor: 'ButtonFace',
      color: 'ButtonText',
    },
  };
});

/**
 * Native modal `<dialog>` for confirming destructive deletions.
 * Follows modern-web-guidance `dialog` & `accessibility`:
 * - Uses `showModal()` (no redundant `role="dialog"` / `aria-modal`).
 * - Focuses the safe Cancel action by default.
 * - Supports `closedby="any"` with pointer outside-rect fallback for Safari.
 */
const ConfirmDeleteDialog = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps): ReactElement | null => {
  const theme = useTheme();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  // Keep latest callbacks in refs so native DOM listeners never go stale.
  const callbacksRef = useRef({ onConfirm, onCancel });
  callbacksRef.current = { onConfirm, onCancel };

  // Pause mindmap keyboard shortcuts while the modal is open.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    DesignerKeyboard?.pause?.();
    return () => {
      DesignerKeyboard?.resume?.();
    };
  }, [open]);

  // Synchronize React `open` state with native `<dialog>` top-layer modal API.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    if (open) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else {
        dialog.setAttribute('open', '');
      }
      cancelButtonRef.current?.focus();
    } else {
      if (typeof dialog.close === 'function') {
        if (dialog.open) {
          dialog.close();
        }
      } else {
        dialog.removeAttribute('open');
      }
    }
    return undefined;
  }, [open]);

  // Fallback for browsers without `closedby="any"` (e.g. Safari) on `<dialog>`.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || 'closedBy' in HTMLDialogElement.prototype) {
      return undefined;
    }

    const isOutside = (e: PointerEvent): boolean => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        if (typeof dialog.close === 'function') {
          dialog.close('');
        } else {
          dialog.removeAttribute('open');
          callbacksRef.current.onCancel();
        }
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    const dialog = dialogRef.current;
    const returnValue = dialog?.returnValue ?? '';
    if (dialog) {
      dialog.returnValue = '';
    }
    if (returnValue === 'confirm') {
      callbacksRef.current.onConfirm();
    } else {
      callbacksRef.current.onCancel();
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const dialog = dialogRef.current;
    // If native `<form method="dialog">` + `dialog.close()` is unavailable (e.g. jsdom),
    // resolve manually so tests and legacy environments behave identically.
    if (!dialog || typeof dialog.close !== 'function') {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent | undefined)?.submitter as
        | HTMLButtonElement
        | undefined;
      dialog?.removeAttribute('open');
      if (submitter?.value === 'confirm') {
        callbacksRef.current.onConfirm();
      } else {
        callbacksRef.current.onCancel();
      }
    }
  };

  return (
    <NativeConfirmDialog
      ref={dialogRef}
      theme={theme}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      data-testid="confirm-delete-dialog"
      {...({ closedby: 'any' } as Record<string, string>)}
      onClose={handleClose}
      onKeyDown={(e) => {
        // Prevent Esc / keys from bubbling to an enclosing MUI Popover.
        e.stopPropagation();
      }}
    >
      <form method="dialog" onSubmit={handleFormSubmit}>
        <DialogBody>
          <IconBadge aria-hidden="true">
            <WarningAmberRoundedIcon fontSize="small" />
          </IconBadge>
          <TextColumn>
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <DialogMessage id={messageId}>{message}</DialogMessage>
          </TextColumn>
        </DialogBody>
        <ActionsRow>
          <ActionButton
            ref={cancelButtonRef}
            type="submit"
            value="cancel"
            tone="cancel"
            autoFocus
            data-testid="confirm-delete-cancel"
          >
            {cancelLabel ?? <FormattedMessage id="action.cancel" defaultMessage="Cancel" />}
          </ActionButton>
          <ActionButton
            type="submit"
            value="confirm"
            tone="danger"
            data-testid="confirm-delete-submit"
          >
            {confirmLabel ?? <FormattedMessage id="action.delete" defaultMessage="Delete" />}
          </ActionButton>
        </ActionsRow>
      </form>
    </NativeConfirmDialog>
  );
};

export default ConfirmDeleteDialog;
