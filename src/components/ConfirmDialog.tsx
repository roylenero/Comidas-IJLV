import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { describeError } from '../lib/errors';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Confirmación que solo se cierra cuando el servidor aceptó la operación. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Volver', tone = 'primary', onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    setError(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      title={title}
      onClose={close}
      dismissible={!busy}
      footer={
        <>
          <button type="button" className={`btn btn--block btn--lg ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`} onClick={confirm} disabled={busy}>
            {busy ? 'Guardando…' : confirmLabel}
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={close} disabled={busy}>
            {cancelLabel}
          </button>
        </>
      }
    >
      {children}
      {error && (
        <p className="banner banner--danger" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
