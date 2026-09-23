import { runTransaction, type Transaction } from 'firebase/firestore';
import { db } from '../firebase/app';
import { SERVER_CONFIRM_TIMEOUT_MS } from '../config/business';
import { assertOnline, withTimeout } from '../lib/errors';

/**
 * Ejecuta escrituras SOLO con confirmación del servidor.
 *
 * Usamos transacciones (incluso para escrituras simples) porque, a diferencia de
 * setDoc/updateDoc, una transacción nunca se queda "en cola" en el dispositivo
 * cuando no hay internet: o el servidor la acepta, o falla. Así la interfaz jamás
 * muestra como guardado algo que no llegó a Firebase.
 */
export function serverWrite<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  assertOnline();
  return withTimeout(runTransaction(db, fn, { maxAttempts: 3 }), SERVER_CONFIRM_TIMEOUT_MS);
}
