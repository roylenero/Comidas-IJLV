import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

interface StateMessageProps {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
}

export function StateMessage({ title, children, icon, action, tone = 'neutral' }: StateMessageProps) {
  return (
    <div className="state" role={tone === 'error' ? 'alert' : undefined}>
      <div className="state__icon" aria-hidden="true">
        {icon ?? (tone === 'error' ? <AlertTriangle size={30} /> : <Inbox size={30} />)}
      </div>
      <h2>{title}</h2>
      {children && <div className="stack-sm">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <StateMessage
      title="Algo salió mal"
      tone="error"
      action={
        onRetry && (
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Reintentar
          </button>
        )
      }
    >
      <p>{message}</p>
    </StateMessage>
  );
}
