import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Evita cerrar mientras se guarda algo. */
  dismissible?: boolean;
}

/** Diálogo modal accesible (hoja inferior en móvil, centrado en escritorio) basado en <dialog>. */
export function Sheet({ open, title, onClose, children, footer, dismissible = true }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && dismissible) onClose();
      }}
    >
      {open && (
        <>
          <div className="sheet__header">
            <h2 id={titleId} className="grow">
              {title}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} disabled={!dismissible} aria-label="Cerrar">
              <X size={22} />
            </button>
          </div>
          <div className="sheet__body">{children}</div>
          {footer && <div className="sheet__footer">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
