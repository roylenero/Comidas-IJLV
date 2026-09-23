import { useSearchParams } from 'react-router-dom';
import { isISODate, todayISO } from '../../lib/dates';
import type { ISODate } from '../../types/models';

/** Fecha seleccionada en administración, guardada en la URL (?fecha=YYYY-MM-DD). */
export function useAdminDate(): [ISODate, (date: ISODate) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('fecha');
  const date = raw && isISODate(raw) ? raw : todayISO();
  const setDate = (next: ISODate) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === todayISO()) p.delete('fecha');
        else p.set('fecha', next);
        return p;
      },
      { replace: true },
    );
  return [date, setDate];
}
