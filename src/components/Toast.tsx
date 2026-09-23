import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div role="status" aria-live="polite">
      {message && (
        <div className="toast">
          <CheckCircle2 size={20} aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
