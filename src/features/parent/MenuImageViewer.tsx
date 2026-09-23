import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { getMenuAsset } from '../../services/menu';
import { describeError } from '../../lib/errors';
import { formatWeekRange } from '../../lib/dates';
import { LoadingState, ErrorState } from '../../components/StateMessage';
import type { ISODate, MenuAsset } from '../../types/models';

const ZOOMS = [1, 1.6, 2.4, 3.2];

/** Visor a pantalla completa con zoom y desplazamiento, cómodo en el celular. */
export function MenuImageViewer({ weekId, onClose }: { weekId: ISODate; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<{ asset?: MenuAsset; error?: string }>({});
  const [zoom, setZoom] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMenuAsset(weekId)
      .then((asset) => !cancelled && setState(asset ? { asset } : { error: 'La imagen del menú ya no está disponible.' }))
      .catch((err) => !cancelled && setState({ error: describeError(err) }));
    return () => {
      cancelled = true;
    };
  }, [weekId, attempt]);

  return (
    <dialog ref={ref} className="viewer" aria-label={`Menú semanal ${formatWeekRange(weekId)}`} onCancel={onClose}>
      <div className="viewer__bar">
        <strong className="grow">Menú · {formatWeekRange(weekId)}</strong>
        <button type="button" className="icon-btn" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Alejar">
          <Minus size={22} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
          disabled={zoom === ZOOMS.length - 1}
          aria-label="Acercar"
        >
          <Plus size={22} />
        </button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          <X size={24} />
        </button>
      </div>
      <div className="viewer__canvas">
        {state.error ? (
          <ErrorState
            message={state.error}
            onRetry={() => {
              setState({});
              setAttempt((a) => a + 1);
            }}
          />
        ) : !state.asset ? (
          <LoadingState label="Cargando imagen del menú…" />
        ) : (
          <img
            src={state.asset.dataUrl}
            alt={`Menú semanal del ${formatWeekRange(weekId)}`}
            style={{ width: `${ZOOMS[zoom] * 100}%`, maxWidth: zoom === 0 ? '100%' : 'none' }}
            onDoubleClick={() => setZoom((z) => (z === 0 ? 2 : 0))}
          />
        )}
      </div>
    </dialog>
  );
}
