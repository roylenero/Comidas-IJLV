import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { describeError } from '../lib/errors';

export interface SubscriptionState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

type Subscribe<T> = (onData: (data: T) => void, onError: (err: Error) => void) => Unsubscribe;

/**
 * Suscripción en tiempo real a Firestore.
 * `key` debe codificar TODOS los parámetros de la consulta; cuando cambia, se vuelve a suscribir.
 * Con key === null no se suscribe.
 */
export function useSubscription<T>(key: string | null, subscribe: Subscribe<T>): SubscriptionState<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error: string | null }>({ key: null, error: null });

  useEffect(() => {
    if (key === null) return;
    return subscribe(
      (data) => setState({ key, data, error: null }),
      (err) => setState({ key, error: describeError(err) }),
    );
    // `key` representa los parámetros de `subscribe`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (key === null) return { data: undefined, error: null, loading: false };
  if (state.key !== key) return { data: undefined, error: null, loading: true };
  return { data: state.data, error: state.error, loading: state.data === undefined && !state.error };
}
