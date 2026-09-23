import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarOff, PlusCircle } from 'lucide-react';
import { useOrdersByDate } from '../../hooks/useData';
import { useSubscription } from '../../hooks/useSubscription';
import { watchMenuDay } from '../../services/menu';
import { formatLongDate } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { SERVICE_LABELS, SERVICE_TYPES } from '../../config/business';
import { ErrorState, LoadingState } from '../../components/StateMessage';
import { ServiceIcon } from '../../components/ServiceIcon';
import type { MenuDay } from '../../types/models';
import { useAdminDate } from './useAdminDate';
import { DateNav } from './DateNav';

export function DashboardPage() {
  const [date, setDate] = useAdminDate();
  const orders = useOrdersByDate(date);
  const menu = useSubscription<MenuDay | null>(`menuDay:${date}`, (onData, onError) => watchMenuDay(date, onData, onError));

  const stats = useMemo(() => {
    const active = (orders.data ?? []).filter((o) => o.status === 'active');
    return {
      breakfast: active.filter((o) => o.service === 'breakfast').length,
      lunch: active.filter((o) => o.service === 'lunch').length,
      total: active.reduce((sum, o) => sum + o.priceAtOrder, 0),
      pending: active.filter((o) => o.paymentStatus === 'pending').length,
    };
  }, [orders.data]);

  return (
    <div className="stack-lg">
      <div className="stack">
        <DateNav date={date} onChange={setDate} />
        <h1 className="date-title" aria-live="polite">
          {formatLongDate(date)}
        </h1>
        {menu.data === null && !menu.loading && <p className="banner banner--warning">No hay menú capturado para este día.</p>}
        {menu.data?.noService && (
          <p className="banner banner--neutral">
            <CalendarOff size={18} aria-hidden="true" /> Día marcado como <strong>Sin servicio</strong>.
          </p>
        )}
      </div>

      {orders.error ? (
        <ErrorState message={orders.error} onRetry={() => window.location.reload()} />
      ) : orders.loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="stat-grid">
            {SERVICE_TYPES.map((service) => (
              <div key={service} className={`stat stat--${service}`}>
                <div className="row">
                  <ServiceIcon service={service} />
                  {menu.data && !menu.data[service].available && !menu.data.noService && (
                    <span className="badge badge--neutral">No disponible</span>
                  )}
                </div>
                <div>
                  <div className="stat__num">{stats[service]}</div>
                  <div className="stat__label">{SERVICE_LABELS[service].plural}</div>
                </div>
                <Link className="btn btn--secondary btn--block" to={`/admin/dia/${date}/${service}`}>
                  Ver {SERVICE_LABELS[service].plural.toLowerCase()}
                </Link>
              </div>
            ))}
          </div>

          <p className="muted">
            Total del día: <strong>{formatMoney(stats.total)}</strong> · Pedidos con pago pendiente: <strong>{stats.pending}</strong>
          </p>

          <Link className="btn btn--primary btn--lg" to={`/admin/pedido-manual?fecha=${date}`} style={{ alignSelf: 'flex-start' }}>
            <PlusCircle size={20} aria-hidden="true" /> Registrar pedido manual
          </Link>
        </>
      )}
    </div>
  );
}
