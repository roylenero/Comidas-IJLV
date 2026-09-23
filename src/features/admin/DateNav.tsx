import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isISODate, shiftWeekday, todayISO } from '../../lib/dates';
import type { ISODate } from '../../types/models';

export function DateNav({ date, onChange }: { date: ISODate; onChange: (d: ISODate) => void }) {
  const today = todayISO();
  return (
    <div className="date-nav">
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onChange(shiftWeekday(date, -1))}>
        <ChevronLeft size={18} aria-hidden="true" /> Día anterior
      </button>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onChange(today)} disabled={date === today}>
        Hoy
      </button>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onChange(shiftWeekday(date, 1))}>
        Día siguiente <ChevronRight size={18} aria-hidden="true" />
      </button>
      <label className="visually-hidden" htmlFor="admin-date">
        Elegir fecha
      </label>
      <input
        id="admin-date"
        type="date"
        className="input"
        style={{ width: 'auto', minHeight: 44, padding: '0 var(--space-3)' }}
        value={date}
        onChange={(e) => isISODate(e.target.value) && onChange(e.target.value)}
      />
    </div>
  );
}
