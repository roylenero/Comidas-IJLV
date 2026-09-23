import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useOrdersByDate } from '../../hooks/useData';
import { useReadySession } from '../../hooks/useSession';
import { capitalize, formatLongDate, isISODate } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { formatMoney } from '../../lib/money';
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceType } from '../../config/business';
import { ErrorState, LoadingState, StateMessage } from '../../components/StateMessage';
import { SearchInput } from '../../components/SearchInput';
import { matches } from '../../lib/text';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PaymentBadge } from '../../components/OrderBadges';
import { ServiceIcon } from '../../components/ServiceIcon';
import { cancelOrder, placeOrders, setPaymentStatus } from '../../services/orders';
import type { Order } from '../../types/models';

export function ServiceDetailPage() {
  const { date = '', service = '' } = useParams();
  if (!isISODate(date) || !(SERVICE_TYPES as readonly string[]).includes(service)) return <Navigate to="/admin" replace />;
  return <ServiceDetail date={date} service={service as ServiceType} />;
}

function ServiceDetail({ date, service }: { date: string; service: ServiceType }) {
  const session = useReadySession();
  const orders = useOrdersByDate(date);
  const [search, setSearch] = useState('');
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = SERVICE_LABELS[service];

  const { active, cancelled } = useMemo(() => {
    const list = (orders.data ?? [])
      .filter((o) => o.service === service)
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
    return { active: list.filter((o) => o.status === 'active'), cancelled: list.filter((o) => o.status === 'cancelled') };
  }, [orders.data, service]);

  const visible = active.filter((o) => matches(o.studentName, search));

  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack-lg">
      <div className="spread no-print">
        <Link to={`/admin?fecha=${date}`} className="btn btn--ghost btn--sm">
          <ArrowLeft size={18} aria-hidden="true" /> Volver al día
        </Link>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Imprimir lista
        </button>
      </div>

      <div className="row">
        <ServiceIcon service={service} size={26} />
        <div>
          <h1>
            {label.plural.toUpperCase()} — {active.length}
          </h1>
          <p className="muted">{capitalize(formatLongDate(date))}</p>
        </div>
      </div>

      {error && (
        <p className="banner banner--danger" role="alert">
          {error}
        </p>
      )}

      {orders.error ? (
        <ErrorState message={orders.error} onRetry={() => window.location.reload()} />
      ) : orders.loading ? (
        <LoadingState />
      ) : active.length === 0 ? (
        <StateMessage title={`No hay ${label.plural.toLowerCase()} solicitados`}>
          <p>Cuando alguien haga un pedido aparecerá aquí en tiempo real.</p>
        </StateMessage>
      ) : (
        <>
          <div className="no-print">
            <SearchInput value={search} onChange={setSearch} label="Buscar alumno" />
          </div>
          <div className="card card--flat">
            <ul className="list table-list">
              {visible.map((o, i) => (
                <li key={o.id}>
                  <span className="muted small" style={{ width: '2ch', textAlign: 'right' }}>
                    {i + 1}
                  </span>
                  <span className="grow">
                    <strong>{o.studentName}</strong>
                    <span className="muted small">
                      {' '}
                      · {formatMoney(o.priceAtOrder)}
                      {o.source === 'admin' ? ' · registrado por administración' : ''}
                    </span>
                  </span>
                  <PaymentBadge paymentStatus={o.paymentStatus} />
                  <span className="row-wrap no-print">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled={busy === o.id}
                      onClick={() =>
                        run(o.id, () => setPaymentStatus([o.id], o.paymentStatus === 'paid' ? 'pending' : 'paid', session.user.uid))
                      }
                    >
                      {o.paymentStatus === 'paid' ? 'Marcar pendiente' : 'Marcar pagado'}
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => setCancelling(o)}>
                      Cancelar
                    </button>
                  </span>
                </li>
              ))}
              {visible.length === 0 && <li className="muted">Ningún alumno coincide con “{search}”.</li>}
            </ul>
          </div>
        </>
      )}

      {cancelled.length > 0 && (
        <details className="past-orders no-print">
          <summary>Cancelados ({cancelled.length})</summary>
          <div className="card card--flat" style={{ marginTop: 'var(--space-3)' }}>
            <ul className="list table-list">
              {cancelled.map((o) => (
                <li key={o.id}>
                  <span className="grow muted">{o.studentName}</span>
                  {o.paymentStatus === 'paid' && <PaymentBadge paymentStatus="paid" />}
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busy === o.id}
                    onClick={() =>
                      run(o.id, () =>
                        placeOrders({
                          date,
                          service,
                          students: [{ id: o.studentId, name: o.studentName, familyId: o.familyId }],
                          uid: session.user.uid,
                          source: 'admin',
                        }),
                      )
                    }
                  >
                    Reactivar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar pedido"
        tone="danger"
        confirmLabel="Sí, cancelar"
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelOrder(cancelling!.id, session.user.uid)}
      >
        {cancelling && (
          <p>
            ¿Cancelar el {label.lower} de <strong>{cancelling.studentName}</strong> del {formatLongDate(date)}?
            {cancelling.paymentStatus === 'paid' && ' Este pedido ya estaba pagado; revisa el saldo con la familia.'}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
