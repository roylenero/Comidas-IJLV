import { useState } from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { ServiceIcon } from '../../components/ServiceIcon';
import { SERVICE_LABELS, type ServiceType } from '../../config/business';
import { formatLongDate } from '../../lib/dates';
import { describeError, isOfflineError } from '../../lib/errors';
import { formatMoney } from '../../lib/money';
import { useOnline } from '../../hooks/useOnline';
import { placeOrders, type PlaceOrdersResult } from '../../services/orders';
import type { ISODate, Student } from '../../types/models';

interface OrderSheetProps {
  open: boolean;
  date: ISODate;
  service: ServiceType;
  price: number;
  students: Student[];
  /** IDs de alumnos que ya tienen este servicio activo. */
  alreadyOrdered: Set<string>;
  uid: string;
  onClose: () => void;
}

type Phase =
  | { kind: 'select' }
  | { kind: 'sending' }
  | { kind: 'done'; result: PlaceOrdersResult }
  | { kind: 'error'; message: string; offline: boolean };

export function OrderSheet(props: OrderSheetProps) {
  // Se vuelve a montar en cada apertura para iniciar limpio.
  return props.open ? <OrderSheetContent {...props} /> : null;
}

function OrderSheetContent({ date, service, price, students, alreadyOrdered, uid, onClose }: OrderSheetProps) {
  const online = useOnline();
  const available = students.filter((s) => !alreadyOrdered.has(s.id));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(available.length === 1 ? [available[0].id] : []));
  const [phase, setPhase] = useState<Phase>({ kind: 'select' });
  const label = SERVICE_LABELS[service];
  const chosen = students.filter((s) => selected.has(s.id));
  const total = chosen.length * price;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setPhase({ kind: 'sending' });
    try {
      const result = await placeOrders({ date, service, students: chosen, uid, source: 'parent' });
      setPhase({ kind: 'done', result });
    } catch (err) {
      setPhase({ kind: 'error', message: describeError(err), offline: isOfflineError(err) });
    }
  }

  const title = `${label.singular} · ${formatLongDate(date)}`;

  if (phase.kind === 'done') {
    const { confirmed, alreadyActive } = phase.result;
    const confirmedTotal = confirmed.reduce((sum, c) => sum + c.price, 0);
    return (
      <Sheet
        open
        title={title}
        onClose={onClose}
        footer={
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onClose}>
            Listo
          </button>
        }
      >
        {confirmed.length > 0 && (
          <div className="stack center" role="status">
            <CheckCircle2 size={56} className="success-icon" aria-hidden="true" style={{ alignSelf: 'center' }} />
            <h3 style={{ fontSize: 'var(--text-xl)' }}>Pedido confirmado</h3>
            <p>
              {label.singular} para <strong>{confirmed.map((c) => c.studentName).join(' y ')}</strong>. Total{' '}
              <strong>{formatMoney(confirmedTotal)}</strong>.
            </p>
            <p className="muted small">Puedes consultarlo o cancelarlo en "Mis pedidos" antes del cierre.</p>
          </div>
        )}
        {alreadyActive.length > 0 && (
          <p className="banner banner--info" role="status">
            {alreadyActive.map((a) => a.studentName).join(' y ')} ya tenía {label.lower} solicitado para este día. No se duplicó.
          </p>
        )}
      </Sheet>
    );
  }

  const sending = phase.kind === 'sending';

  return (
    <Sheet
      open
      title={title}
      onClose={onClose}
      dismissible={!sending}
      footer={
        <>
          {!online && (
            <p className="banner banner--warning" role="alert">
              <WifiOff size={18} aria-hidden="true" /> Sin conexión. Conéctate a internet para confirmar el pedido.
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            disabled={chosen.length === 0 || sending || !online}
            onClick={submit}
          >
            {sending ? 'Enviando pedido…' : phase.kind === 'error' ? 'Reintentar' : 'Confirmar pedido'}
          </button>
        </>
      }
    >
      <div className="row">
        <ServiceIcon service={service} />
        <p className="grow">
          <strong>{label.singular}</strong> · {formatMoney(price)} por alumno
        </p>
      </div>

      <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }} disabled={sending}>
        <legend className="field__label" style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-base)' }}>
          ¿Para quién deseas pedir?
        </legend>
        {students.map((s) => {
          const done = alreadyOrdered.has(s.id);
          return (
            <label key={s.id} className="check-card">
              <input type="checkbox" checked={done || selected.has(s.id)} disabled={done} onChange={() => toggle(s.id)} />
              <span className="grow">{s.name}</span>
              {done && <span className="badge badge--success">Ya solicitado</span>}
            </label>
          );
        })}
      </fieldset>

      {chosen.length > 0 && (
        <section className="summary" aria-label="Resumen del pedido">
          <p className="section-title">Resumen</p>
          <ul className="list">
            {chosen.map((s) => (
              <li key={s.id} className="spread list-row">
                <span>
                  <strong>{s.name}</strong>
                  <br />
                  <span className="muted small">{label.singular}</span>
                </span>
                <span>{formatMoney(price)}</span>
              </li>
            ))}
          </ul>
          <div className="spread summary__total">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </section>
      )}

      {phase.kind === 'error' && (
        <div className={`banner ${phase.offline ? 'banner--warning' : 'banner--danger'}`} role="alert">
          <p>
            <strong>El pedido NO se confirmó.</strong> {phase.message}
          </p>
        </div>
      )}
    </Sheet>
  );
}
