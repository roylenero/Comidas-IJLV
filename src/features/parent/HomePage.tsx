import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, CalendarOff } from 'lucide-react';
import { useReadySession } from '../../hooks/useSession';
import { useFamilyOrders, useMenuDays, useMenuWeek, useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import {
  addDays,
  defaultDayInWeek,
  defaultWeekStart,
  formatLongDate,
  formatWeekRange,
  capitalize,
  todayISO,
  weekdaysOf,
} from '../../lib/dates';
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceType } from '../../config/business';
import { ErrorState, LoadingState, StateMessage } from '../../components/StateMessage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import { cancelOrder } from '../../services/orders';
import type { ISODate, Order } from '../../types/models';
import { WeekStrip } from './WeekStrip';
import { ServiceCard } from './ServiceCard';
import { OrderSheet } from './OrderSheet';
import { MenuImageViewer } from './MenuImageViewer';

export function HomePage() {
  const session = useReadySession();
  const now = useNow();
  const today = todayISO(now);
  const [weekStart, setWeekStart] = useState(() => defaultWeekStart());
  const [selected, setSelected] = useState(() => defaultDayInWeek(defaultWeekStart()));
  const [ordering, setOrdering] = useState<ServiceType | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const days = useMemo(() => weekdaysOf(weekStart), [weekStart]);
  const week = useMenuWeek(weekStart);
  const menu = useMenuDays(weekStart);
  const settings = useSettings();
  const orders = useFamilyOrders(session.familyId, weekStart, days[4]);

  const activeOrders = useMemo(() => (orders.data ?? []).filter((o) => o.status === 'active'), [orders.data]);
  const menuByDate = useMemo(() => new Map((menu.data ?? []).map((d) => [d.date, d])), [menu.data]);
  const marks = useMemo(
    () =>
      Object.fromEntries(
        days.map((d) => [d, { ordered: activeOrders.some((o) => o.date === d), noService: menuByDate.get(d)?.noService ?? false }]),
      ),
    [days, activeOrders, menuByDate],
  );

  function goWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelected(defaultDayInWeek(next));
  }

  const day = menuByDate.get(selected);
  const firstNames = session.students.map((s) => s.name.split(' ')[0]);
  const error = menu.error ?? orders.error ?? settings.error;

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1>Menú de la semana</h1>
        <p className="muted">Pedidos para {firstNames.join(', ').replace(/, ([^,]*)$/, ' y $1')}</p>
      </div>

      <div className="stack">
        <div className="spread">
          <button type="button" className="icon-btn" onClick={() => goWeek(-1)} aria-label="Semana anterior">
            <ChevronLeft size={24} />
          </button>
          <p className="week-range" aria-live="polite">
            {formatWeekRange(weekStart)}
          </p>
          <button type="button" className="icon-btn" onClick={() => goWeek(1)} aria-label="Semana siguiente">
            <ChevronRight size={24} />
          </button>
        </div>
        <WeekStrip days={days} selected={selected} today={today} onSelect={setSelected} marks={marks} />
        {week.data?.hasImage && (
          <button type="button" className="btn btn--secondary btn--block" onClick={() => setShowImage(true)}>
            <ImageIcon size={20} aria-hidden="true" /> Ver menú semanal
          </button>
        )}
      </div>

      <section className="stack" aria-labelledby="day-title">
        <h2 id="day-title" className="day-title">
          {capitalize(formatLongDate(selected))}
          {selected === today && <span className="badge badge--info">Hoy</span>}
        </h2>

        {error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : menu.loading || orders.loading || settings.loading ? (
          <LoadingState />
        ) : !day ? (
          <StateMessage title="Menú aún no publicado">
            <p>El Instituto todavía no publica el menú de este día. Vuelve a revisar más tarde.</p>
          </StateMessage>
        ) : day.noService ? (
          <StateMessage title="Sin servicio" icon={<CalendarOff size={30} />}>
            <p>Este día no hay servicio de desayuno ni comida.</p>
          </StateMessage>
        ) : (
          SERVICE_TYPES.map((service) => (
            <ServiceCard
              key={service}
              service={service}
              menu={day[service]}
              price={settings.data?.prices[service]}
              students={session.students}
              activeOrders={activeOrders.filter((o) => o.date === selected && o.service === service)}
              now={now}
              onOrder={() => setOrdering(service)}
              onCancel={setCancelling}
            />
          ))
        )}
      </section>

      {ordering && settings.data && (
        <OrderSheet
          open
          date={selected}
          service={ordering}
          price={settings.data.prices[ordering]}
          students={session.students}
          alreadyOrdered={new Set(activeOrders.filter((o) => o.date === selected && o.service === ordering).map((o) => o.studentId))}
          uid={session.user.uid}
          onClose={() => setOrdering(null)}
        />
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
            {formatLongDate(cancelling.date as ISODate)}?
          </p>
        )}
      </ConfirmDialog>

      {showImage && <MenuImageViewer weekId={weekStart} onClose={() => setShowImage(false)} />}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
