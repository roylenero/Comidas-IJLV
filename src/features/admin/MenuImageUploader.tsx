import { useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { compressMenuImage } from '../../lib/image';
import { describeError } from '../../lib/errors';
import { getMenuAsset, removeMenuImage, saveMenuImage } from '../../services/menu';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ISODate, MenuAsset } from '../../types/models';

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export function MenuImageUploader({ weekId, hasImage }: { weekId: ISODate; hasImage: boolean }) {
  const [current, setCurrent] = useState<{ weekId: string; asset: MenuAsset | null } | null>(null);
  const [pending, setPending] = useState<MenuAsset | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'saving'>('idle');
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const imageKey = hasImage ? weekId : null;

  useEffect(() => {
    if (!imageKey) return;
    let cancelled = false;
    getMenuAsset(imageKey)
      .then((asset) => !cancelled && setCurrent({ weekId: imageKey, asset }))
      .catch((err) => !cancelled && setMessage({ tone: 'danger', text: describeError(err) }));
    return () => {
      cancelled = true;
    };
  }, [imageKey]);

  const shown = pending ?? (hasImage && current?.weekId === weekId ? current.asset : null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setStatus('processing');
    try {
      setPending(await compressMenuImage(file));
    } catch (err) {
      setMessage({ tone: 'danger', text: describeError(err) });
    } finally {
      setStatus('idle');
    }
  }

  async function save() {
    if (!pending) return;
    setStatus('saving');
    setMessage(null);
    try {
      await saveMenuImage(weekId, pending);
      setCurrent({ weekId, asset: pending });
      setPending(null);
      setMessage({ tone: 'success', text: 'Imagen guardada. Las familias ya pueden verla.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: describeError(err) });
    } finally {
      setStatus('idle');
    }
  }

  return (
    <section className="card stack" aria-labelledby="img-title">
      <div className="stack-sm">
        <h2 id="img-title">Imagen del menú semanal</h2>
        <p className="muted small">
          Opcional y complementaria: los pedidos dependen de los datos capturados abajo, no de la imagen. JPG, PNG o WebP; se
          comprime automáticamente (máx. 1600 px, ~600 KB).
        </p>
      </div>

      {shown ? (
        <figure className="stack-sm" style={{ margin: 0 }}>
          <img src={shown.dataUrl} alt="Vista previa del menú semanal" className="image-preview" />
          <figcaption className="muted small">
            {pending ? 'Vista previa (sin guardar)' : 'Imagen publicada'} · {shown.width}×{shown.height} px · {kb(shown.bytes)}
          </figcaption>
        </figure>
      ) : (
        hasImage && !current && <p className="muted">Cargando imagen…</p>
      )}

      {message && (
        <p className={`banner banner--${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}

      <div className="row-wrap">
        <label className="btn btn--secondary" aria-disabled={status !== 'idle'}>
          <ImagePlus size={20} aria-hidden="true" />
          {status === 'processing' ? 'Procesando…' : hasImage ? 'Reemplazar imagen' : 'Subir imagen del menú semanal'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            disabled={status !== 'idle'}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {pending && (
          <>
            <button type="button" className="btn btn--primary" onClick={save} disabled={status !== 'idle'}>
              {status === 'saving' ? 'Guardando…' : 'Guardar imagen'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setPending(null)} disabled={status !== 'idle'}>
              Descartar
            </button>
          </>
        )}
        {hasImage && !pending && (
          <button type="button" className="btn btn--danger" onClick={() => setConfirmRemove(true)}>
            <Trash2 size={18} aria-hidden="true" /> Quitar imagen
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Quitar imagen"
        tone="danger"
        confirmLabel="Sí, quitar"
        onClose={() => setConfirmRemove(false)}
        onConfirm={async () => {
          await removeMenuImage(weekId);
          setCurrent(null);
        }}
      >
        <p>Las familias dejarán de ver la imagen de esta semana. El menú capturado no cambia.</p>
      </ConfirmDialog>
    </section>
  );
}
