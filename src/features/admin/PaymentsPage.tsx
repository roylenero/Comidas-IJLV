import { useMemo, useState } from 'react';
import { useFamilies } from '../../hooks/useData';
import { useSubscription } from '../../hooks/useSubscription';
import { useReadySession } from '../../hooks/useSession';
import { watchPaidOrdersInRange, watchPendingPayments, setPaymentStatus } from '../../services/orders';
import { addDays, capitalize, formatLongDate, todayISO } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { formatMoney } from '../../lib/money';
import { matches } from '../../lib/text';
import { SERVICE_LABELS } from '../../config/business';
import { ErrorState, LoadingState, StateMessage } from '../../components/StateMessage';
import { SearchInput } from '../../components/SearchInput';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Order } from '../../types/models';

interface Group {
  familyId: string;
  name: string;
  orders: Order[];
  total: number;
}

export function PaymentsPage() {
  const session = useReadySession();
  const families = useFamilies();
  const pending = useSubscription<Order[]>('pendingPayments', watchPendingPayments);
  const [range] = useState(() => ({ from: addDays(todayISO(), -60), to: addDays(todayISO(), 120) }));
  const paid = useSubscription<Order[]>(`paid:${range.from}:${range.to}`, (onData, onError) =>
    watchPaidOrdersInRange(range.from, range.to, onData, onError),
  );
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<Group | null>(null);

  const groups = useMemo(() => {
    const names = new Map((families.data ?? []).map((f) => [f.id, f.name]));
    const map = new Map<string, Group>();
    for (const o of (pending.data ?? []).filter((o) => o.status === 'active')) {
      const g = map.get(o.familyId) ?? { familyId: o.familyId, name: names.get(o.familyId) ?? 'Familia sin nombre', orders: [], total: 0 };
      g.orders.push(o);
      g.total += o.priceAtOrder;
      map.set(o.familyId, g);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [pending.data, families.data]);

  const cancelledPaid = (paid.data ?? []).filter((o) => o.status === 'cancelled');
  const visible = groups.filter((g) => !search.trim() || matches(g.name, search) || g.orders.some((o) => matches(o.studentName, search)));
  const grandTotal = groups.reduce((n, g) => n + g.total, 0);

  async function mark(key: string, ids: string[], status: 'paid' | 'pending') {
    setBusy(key);
    setError(null);
    try {
      await setPaymentStatus(ids, status, session.user.uid);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  const loadError = pending.error ?? families.error ?? paid.error;

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1>Pagos pendientes</h1>
        {!pending.loading && !loadError && (
          <p className="muted">
            Total por cobrar: <strong>{formatMoney(grandTotal)}</strong> en {groups.length} familias
          </p>
        )}
      </div>

      {error && (
        <p className="banner banner--danger" role="alert">
          {error}
        </p>
      )}

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      ) : pending.loading || families.loading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <StateMessage title="No hay pagos pendientes">
          <p>Todos los pedidos activos están marcados como pagados.</p>
        </StateMessage>
      ) : (
        <>
          <SearchInput value={search} onChange={setSearch} label="Buscar familia o alumno" />
          <div className="admin-grid admin-grid--2">
            {visible.map((g) => (
              <section key={g.familyId} className="card card--flat stack-sm" aria-labelledby={`pg-${g.familyId}`}>
                <div className="spread">
                  <h2 id={`pg-${g.familyId}`} style={{ fontSize: 'var(--text-base)' }}>
                    {g.name}
                  </h2>
                  <strong>{formatMoney(g.total)}</strong>
                </div>
                <ul className="list">
                  {g.orders.map((o) => (
                    <li key={o.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                      <span className="grow small">
                        <strong>{o.studentName}</strong> · {SERVICE_LABELS[o.service].singular}
                        <br />
                        <span className="muted">
                          {capitalize(formatLongDate(o.date))} · {formatMoney(o.priceAtOrder)}
                        </span>
                      </span>
                      <button type="button" className="btn btn--secondary btn--sm" disabled={busy !== null} onClick={() => mark(o.id, [o.id], 'paid')}>
                        Marcar pagado
                      </button>
                    </li>
                  ))}
                </ul>
                {g.orders.length > 1 && (
                  <button type="button" className="btn btn--primary btn--sm" disabled={busy !== null} onClick={() => setConfirmGroup(g)}>
                    Marcar todo pagado ({formatMoney(g.total)})
                  </button>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {cancelledPaid.length > 0 && (
        <section className="stack-sm" aria-labelledby="cp-title">
          <h2 id="cp-title">Cancelados que ya estaban pagados</h2>
          <p className="muted small">Revisa con la familia si se devuelve el dinero o se aplica a otro pedido. Al resolverlo, márcalo como pendiente para quitarlo de esta lista.</p>
          <div className="card card--flat">
            <ul className="list">
              {cancelledPaid.map((o) => (
                <li key={o.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                  <span className="grow small">
                    <strong>{o.studentName}</strong> · {SERVICE_LABELS[o.service].singular} · {capitalize(formatLongDate(o.date))} ·{' '}
                    {formatMoney(o.priceAtOrder)}
                  </span>
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== null} onClick={() => mark(o.id, [o.id], 'pending')}>
                    Marcar como resuelto
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmGroup !== null}
        title="Marcar como pagado"
        confirmLabel="Sí, marcar pagado"
        onClose={() => setConfirmGroup(null)}
        onConfirm={() => setPaymentStatus(confirmGroup!.orders.map((o) => o.id), 'paid', session.user.uid)}
      >
        {confirmGroup && (
          <p>
            ¿Marcar como pagados los {confirmGroup.orders.length} pedidos de <strong>{confirmGroup.name}</strong> por{' '}
            <strong>{formatMoney(confirmGroup.total)}</strong>?
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
