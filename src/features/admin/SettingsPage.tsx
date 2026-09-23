import { useState, type FormEvent } from 'react';
import { useSettings } from '../../hooks/useData';
import { describeError } from '../../lib/errors';
import { formatCutoffTime } from '../../lib/dates';
import { CONTACT_PHONE, DEFAULT_PRICES, SERVICE_LABELS, SERVICE_TYPES, TIMEZONE, type ServiceType } from '../../config/business';
import { savePrices } from '../../services/settings';
import { ErrorState, LoadingState } from '../../components/StateMessage';
import { ServiceIcon } from '../../components/ServiceIcon';

export function SettingsPage() {
  const settings = useSettings();
  if (settings.error) return <ErrorState message={settings.error} onRetry={() => window.location.reload()} />;
  if (settings.loading) return <LoadingState />;
  return <PricesForm key={JSON.stringify(settings.data?.prices ?? null)} current={settings.data?.prices ?? null} />;
}

function PricesForm({ current }: { current: Record<ServiceType, number> | null }) {
  const initial = current ?? DEFAULT_PRICES;
  const [values, setValues] = useState<Record<ServiceType, string>>({
    breakfast: String(initial.breakfast),
    lunch: String(initial.lunch),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const parsed = Object.fromEntries(SERVICE_TYPES.map((s) => [s, Number(values[s].replace(',', '.'))])) as Record<ServiceType, number>;
  const invalid = SERVICE_TYPES.some((s) => values[s].trim() === '' || !Number.isFinite(parsed[s]) || parsed[s] < 0 || parsed[s] > 10000);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await savePrices(parsed);
      setMessage({ tone: 'success', text: 'Precios guardados. Aplican a los pedidos nuevos.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg" style={{ maxWidth: '36rem' }}>
      <h1>Precios</h1>
      {!current && (
        <p className="banner banner--warning" role="alert">
          Los precios aún no están configurados y las familias no pueden pedir. Revisa los valores y guárdalos.
        </p>
      )}
      <form className="card stack" onSubmit={submit}>
        {SERVICE_TYPES.map((s) => (
          <div key={s} className="field">
            <label className="field__label row" htmlFor={`price-${s}`}>
              <ServiceIcon service={s} /> {SERVICE_LABELS[s].singular} (MXN)
            </label>
            <input
              id={`price-${s}`}
              className="input"
              inputMode="decimal"
              value={values[s]}
              onChange={(e) => setValues((v) => ({ ...v, [s]: e.target.value }))}
              style={{ maxWidth: '10rem' }}
            />
          </div>
        ))}
        <p className="muted small">Cada pedido guarda el precio vigente al momento de hacerse. Cambiar el precio no modifica pedidos existentes.</p>
        {message && (
          <p className={`banner banner--${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy || invalid} style={{ alignSelf: 'flex-start' }}>
          {busy ? 'Guardando…' : 'Guardar precios'}
        </button>
      </form>

      <section className="card stack-sm" aria-labelledby="fixed-title">
        <h2 id="fixed-title">Reglas fijas</h2>
        <p className="muted small">Se cambian en el código (src/config/business.ts) porque forman parte de las reglas del sistema.</p>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>Cierre de desayuno: {formatCutoffTime('breakfast')}</li>
          <li>Cierre de comida: {formatCutoffTime('lunch')}</li>
          <li>Zona horaria: {TIMEZONE}</li>
          <li>Teléfono para pedidos fuera de horario: {CONTACT_PHONE.display}</li>
        </ul>
      </section>
    </div>
  );
}
