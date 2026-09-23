import type { Order } from '../types/models';

export function OrderStatusBadge({ status }: { status: Order['status'] }) {
  return status === 'active' ? (
    <span className="badge badge--success">Confirmado</span>
  ) : (
    <span className="badge badge--neutral">Cancelado</span>
  );
}

export function PaymentBadge({ paymentStatus }: { paymentStatus: Order['paymentStatus'] }) {
  return paymentStatus === 'paid' ? (
    <span className="badge badge--info">Pagado</span>
  ) : (
    <span className="badge badge--warning">Pago pendiente</span>
  );
}
