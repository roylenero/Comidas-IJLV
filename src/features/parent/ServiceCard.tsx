import { Check } from 'lucide-react';
import { ServiceIcon } from '../../components/ServiceIcon';
import { SERVICE_LABELS, type ServiceType } from '../../config/business';
import { formatCutoffTime, isBeforeCutoff } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import type { MenuService, Order, Student } from '../../types/models';
import { ClosedNotice } from './ClosedNotice';

interface ServiceCardProps {
  service: ServiceType;
  menu: MenuService;
  price: number | undefined;
  students: Student[];
  activeOrders: Order[];
  now: number;
  onOrder: () => void;
  onCancel: (order: Order) => void;
}

export function ServiceCard({ service, menu, price, students, activeOrders, now, onOrder, onCancel }: ServiceCardProps) {
  const label = SERVICE_LABELS[service];
  const open = isBeforeCutoff(menu.cutoffAt.toDate(), now);
  const pendingStudents = students.filter((s) => !activeOrders.some((o) => o.studentId === s.id));
  const headingId = `svc-${service}`;

  return (
    <section className={`service-card service-card--${service}`} aria-labelledby={headingId}>
      <header className="row">
        <ServiceIcon service={service} />
        <div className="grow">
          <h3 id={headingId} className="service-card__title">
            {label.singular}
          </h3>
          {menu.available && (
            <p className="muted small">{open ? `Pide antes de las ${formatCutoffTime(service)}` : 'Pedidos cerrados'}</p>
          )}
        </div>
        {menu.available && price !== undefined && <span className="service-card__price">{formatMoney(price)}</span>}
      </header>

      {menu.available ? (
        <p className="service-card__desc">{menu.description || <span className="muted">Descripción pendiente.</span>}</p>
      ) : (
        <p className="muted">No hay {label.lower} este día.</p>
      )}

      {activeOrders.length > 0 && (
        <ul className="list ordered-list">
          {activeOrders.map((o) => (
            <li key={o.id} className="spread ordered-list__item">
              <span className="row" style={{ gap: 'var(--space-2)' }}>
                <Check size={20} className="success-icon" aria-hidden="true" />
                <span>
                  Solicitado para <strong>{o.studentName.split(' ')[0]}</strong>
                </span>
              </span>
              {open && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onCancel(o)}>
                  Cancelar<span className="visually-hidden"> {label.lower} de {o.studentName}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {menu.available &&
        (open ? (
          pendingStudents.length > 0 && (
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onOrder} disabled={price === undefined}>
              Pedir {label.lower}
            </button>
          )
        ) : (
          <ClosedNotice service={service} />
        ))}
    </section>
  );
}
