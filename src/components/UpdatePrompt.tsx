import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/** Avisa cuando hay una versión nueva; se actualiza solo cuando el usuario lo decide. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Revisa si hay versión nueva cada hora mientras la app está abierta.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="toast" role="alert" style={{ justifyContent: 'space-between' }}>
      <span>Hay una nueva versión disponible.</span>
      <span className="row">
        <button type="button" className="btn btn--sm btn--ghost" style={{ color: '#fff' }} onClick={() => setNeedRefresh(false)}>
          Después
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => updateServiceWorker(true)}>
          <RefreshCw size={16} aria-hidden="true" /> Actualizar
        </button>
      </span>
    </div>
  );
}
