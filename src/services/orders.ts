import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentSnapshot,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/app';
import { COL, SETTINGS_DOC_ID } from '../firebase/paths';
import { orderIdFor } from '../lib/orderId';
import { AppError } from '../lib/errors';
import type { ISODate, Order, OrderSource, PaymentStatus, ServiceType, Settings, Student } from '../types/models';
import { serverWrite } from './serverWrite';

export interface PlaceOrdersInput {
  date: ISODate;
  service: ServiceType;
  students: Pick<Student, 'id' | 'name' | 'familyId'>[];
  uid: string;
  source: OrderSource;
}

export interface PlaceOrdersResult {
  /** Alumnos con pedido nuevo o reactivado, confirmado por el servidor. */
  confirmed: { studentId: string; studentName: string; price: number }[];
  /** Alumnos que ya tenían ese servicio activo (no se duplicó). */
  alreadyActive: { studentId: string; studentName: string }[];
}

const orderRef = (id: string) => doc(db, COL.orders, id);

function toOrder(snap: DocumentSnapshot): Order {
  return { id: snap.id, ...snap.data() } as Order;
}

/**
 * Crea (o reactiva si estaba cancelado) el pedido de uno o varios alumnos en una
 * sola transacción. El ID determinista impide duplicados; si un alumno ya tiene el
 * servicio activo se reporta y no se toca. El precio se toma de settings/app DENTRO
 * de la transacción, así que siempre es el vigente y queda congelado en el pedido.
 */
export function placeOrders(input: PlaceOrdersInput): Promise<PlaceOrdersResult> {
  const { date, service, students, uid, source } = input;
  if (students.length === 0) return Promise.resolve({ confirmed: [], alreadyActive: [] });

  return serverWrite(async (tx) => {
    const settingsSnap = await tx.get(doc(db, COL.settings, SETTINGS_DOC_ID));
    const price = (settingsSnap.data() as Settings | undefined)?.prices?.[service];
    if (typeof price !== 'number') {
      throw new AppError('validation', 'Los precios aún no están configurados. Comunícate con el Instituto.');
    }

    const refs = students.map((s) => orderRef(orderIdFor(date, s.id, service)));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    const result: PlaceOrdersResult = { confirmed: [], alreadyActive: [] };
    snaps.forEach((snap, i) => {
      const student = students[i];
      const existing = snap.exists() ? toOrder(snap) : null;
      if (existing?.status === 'active') {
        result.alreadyActive.push({ studentId: student.id, studentName: student.name });
        return;
      }
      if (existing) {
        tx.update(refs[i], { status: 'active', priceAtOrder: price, updatedAt: serverTimestamp(), updatedBy: uid });
      } else {
        tx.set(refs[i], {
          date,
          studentId: student.id,
          studentName: student.name,
          familyId: student.familyId,
          service,
          priceAtOrder: price,
          status: 'active',
          paymentStatus: 'pending',
          source,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: uid,
          updatedBy: uid,
        });
      }
      result.confirmed.push({ studentId: student.id, studentName: student.name, price });
    });
    return result;
  });
}

export function cancelOrder(orderId: string, uid: string): Promise<void> {
  return serverWrite(async (tx) => {
    const snap = await tx.get(orderRef(orderId));
    if (!snap.exists()) throw new AppError('validation', 'El pedido ya no existe.');
    if (snap.data().status === 'cancelled') return;
    tx.update(orderRef(orderId), { status: 'cancelled', updatedAt: serverTimestamp(), updatedBy: uid });
  });
}

/** Solo administración (las reglas lo impiden a los padres). */
export function setPaymentStatus(orderIds: string[], paymentStatus: PaymentStatus, uid: string): Promise<void> {
  return serverWrite(async (tx) => {
    const refs = orderIds.map(orderRef);
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    snaps.forEach((snap, i) => {
      if (snap.exists()) tx.update(refs[i], { paymentStatus, updatedAt: serverTimestamp(), updatedBy: uid });
    });
  });
}

type Listener<T> = (data: T) => void;

function watchOrders(q: Query, onData: Listener<Order[]>, onError: Listener<Error>): Unsubscribe {
  return onSnapshot(q, (snap) => onData(snap.docs.map(toOrder)), onError);
}

/** Pedidos de una familia en un rango de fechas (incluye cancelados). */
export function watchFamilyOrders(
  familyId: string,
  from: ISODate,
  to: ISODate,
  onData: Listener<Order[]>,
  onError: Listener<Error>,
): Unsubscribe {
  const q = query(
    collection(db, COL.orders),
    where('familyId', '==', familyId),
    where('date', '>=', from),
    where('date', '<=', to),
    orderBy('date'),
  );
  return watchOrders(q, onData, onError);
}

/** Todos los pedidos de un día (administración). */
export function watchOrdersByDate(date: ISODate, onData: Listener<Order[]>, onError: Listener<Error>): Unsubscribe {
  return watchOrders(query(collection(db, COL.orders), where('date', '==', date)), onData, onError);
}

/** Pedidos con pago pendiente (administración). */
export function watchPendingPayments(onData: Listener<Order[]>, onError: Listener<Error>): Unsubscribe {
  const q = query(collection(db, COL.orders), where('paymentStatus', '==', 'pending'), orderBy('date'));
  return watchOrders(q, onData, onError);
}

/** Pedidos pagados en un rango (para detectar cancelados ya pagados). */
export function watchPaidOrdersInRange(
  from: ISODate,
  to: ISODate,
  onData: Listener<Order[]>,
  onError: Listener<Error>,
): Unsubscribe {
  const q = query(
    collection(db, COL.orders),
    where('paymentStatus', '==', 'paid'),
    where('date', '>=', from),
    where('date', '<=', to),
    orderBy('date'),
  );
  return watchOrders(q, onData, onError);
}
