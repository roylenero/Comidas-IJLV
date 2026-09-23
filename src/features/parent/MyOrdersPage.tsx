import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { useReadySession } from '../../hooks/useSession';
import { useFamilyOrders } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { addDays, capitalize, cutoffInstant, formatLongDate, isBeforeCutoff, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { describeError } from '../../lib/errors';
import { SERVICE_LABELS } from '../../config/business';
import { ErrorState, LoadingState, StateMessage } from '../../components/StateMessage';
import { ServiceIcon } from '../../components/ServiceIcon';
import { OrderStatusBadge, PaymentBadge } from '../../components/OrderBadges';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import { cancelOrder, placeOrders } from '../../services/orders';
import type { ISODate, Order } from '../../types/models';

const PAST_DAYS = 30;
const FUTURE_DAYS = 90;

function groupByDate(orders: Order[]): [ISODate, Order[]][] {
  const map = new Map<ISODate, Order[]>();
  for (const o of orders) map.set(o.date, [...(map.get(o.date) ?? []), o]);
  return [...map.entries()].map(([date, list]) => [
    date,
    list.sort((a, b) => a.studentName.localeCompare(b.studentName, 'es') || a.service.localeCompare(b.service)),
  ]);
}

export function MyOrdersPage() {
  const session = useReadySession();
  const now = useNow();
  const today = todayISO(now);
  // Rango fijo al montar la página para no reiniciar la suscripción cada minuto.
  const [range] = useState(() => ({ from: addDays(todayISO(), -PAST_DAYS), to: addDays(todayISO(), FUTURE_DAYS) }));
  const orders = useFamilyOrders(session.familyId, range.from, range.to);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { upcoming, past, pendingTotal } = useMemo(() => {
    const list = orders.data ?? [];
    return {
      upcoming: groupByDate(list.filter((o) => o.date >= today)),
      past: groupByDate(list.filter((o) => o.date < today)).reverse(),
      pendingTotal: list
        .filter((o) => o.status === 'active' && o.paymentStatus === 'pending')
        .reduce((sum, o) => sum + o.priceAtOrder, 0),
    };
  }, [orders.data, today]);

  async function reorder(order: Order) {
    setBusyId(order.id);
    setRowError(null);
    try {
      const student = session.students.find((s) => s.id === order.studentId);
      if (!student) throw new Error('Alumno no disponible');
      await placeOrders({ date: order.date, service: order.service, students: [student], uid: session.user.uid, source: 'parent' });
      setToast('Pedido confirmado.');
    } catch (err) {
      setRowError({ id: order.id, message: describeError(err) });
    } finally {
      setBusyId(null);
    }
  }

  function renderOrder(order: Order) {
    const open = isBeforeCutoff(cutoffInstant(order.date, order.service), now);
    const label = SERVICE_LABELS[order.service];
    return (
      <li key={order.id} className="order-row">
        <ServiceIcon service={order.service} />
        <div className="stack-sm" style={{ gap: 'var(--space-1)', minWidth: 0 }}>
          <strong>{order.studentName}</strong>
          <span className="muted">
            {label.singular} · <span className={order.status === 'cancelled' ? 'strike' : ''}>{formatMoney(order.priceAtOrder)}</span>
          </span>
          <div className="row-wrap">
            <OrderStatusBadge status={order.status} />
            {(order.status === 'active' || order.paymentStatus === 'paid') && <PaymentBadge paymentStatus={order.paymentStatus} />}
          </div>
        </div>
        <div className="order-row__actions">
          {!open ? (
            <span className="muted small">Pedido cerrado</span>
          ) : order.status === 'active' ? (
            <button type="button" className="btn btn--danger btn--sm" onClick={() => setCancelling(order)}>
              Cancelar<span className="visually-hidden"> {label.lower} de {order.studentName}</span>
            </button>
          ) : (
            <button type="button" className="btn btn--secondary btn--sm" disabled={busyId === order.id} onClick={() => reorder(order)}>
              {busyId === order.id ? 'Enviando…' : 'Volver a pedir'}
            </button>
          )}
        </div>
        {rowError?.id === order.id && (
          <p className="banner banner--danger" role="alert" style={{ gridColumn: '1 / -1' }}>
            No se confirmó. {rowError.message}
          </p>
        )}
      </li>
    );
  }

  function renderGroups(groups: [ISODate, Order[]][]) {
    return groups.map(([date, list]) => (
      <section key={date} className="stack-sm" aria-labelledby={`d-${date}`}>
        <h2 id={`d-${date}`} className="section-title">
          {formatLongDate(date).toUpperCase()}
          {date === today ? ' · HOY' : ''}
        </h2>
        <div className="card card--flat">
          <ul className="list">{list.map(renderOrder)}</ul>
        </div>
      </section>
    ));
  }

  return (
    <div className="stack-lg">
      <h1>Mis pedidos</h1>

      {orders.error ? (
        <ErrorState message={orders.error} onRetry={() => window.location.reload()} />
      ) : orders.loading ? (
        <LoadingState />
      ) : (orders.data ?? []).length === 0 ? (
        <StateMessage
          title="Aún no tienes pedidos"
          icon={<ClipboardList size={30} />}
          action={
            <Link to="/" className="btn btn--primary">
              Ver menú y pedir
            </Link>
          }
        >
          <p>Cuando pidas un desayuno o una comida aparecerá aquí.</p>
        </StateMessage>
      ) : (
        <>
          {pendingTotal > 0 && (
            <div className="banner banner--warning">
              <p>
                Pagos pendientes: <strong>{formatMoney(pendingTotal)}</strong>
              </p>
            </div>
          )}
          {upcoming.length > 0 ? (
            renderGroups(upcoming)
          ) : (
            <p className="muted">No tienes pedidos próximos.</p>
          )}
          {past.length > 0 && (
            <details className="past-orders">
              <summary>Pedidos anteriores (últimos {PAST_DAYS} días)</summary>
              <div className="stack-lg" style={{ marginTop: 'var(--space-4)' }}>
                {renderGroups(past)}
              </div>
            </details>
          )}
        </>
      )}

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar pedido"
        tone="danger"
        confirmLabel="Sí, cancelar pedido"
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          if (!cancelling) return;
          await cancelOrder(cancelling.id, session.user.uid);
          setToast('Pedido cancelado.');
        }}
      >
        {cancelling && (
          <p>
            ¿Cancelar el <strong>{SERVICE_LABELS[cancelling.service].lower}</strong> de <strong>{cancelling.studentName}</strong> del{' '}
            {capitalize(formatLongDate(cancelling.date))}?
          </p>
        )}
      </ConfirmDialog>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
