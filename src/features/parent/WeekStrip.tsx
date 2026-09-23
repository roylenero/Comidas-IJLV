import { formatDayChip } from '../../lib/dates';
import type { ISODate } from '../../types/models';

interface WeekStripProps {
  days: ISODate[];
  selected: ISODate;
  today: ISODate;
  onSelect: (date: ISODate) => void;
  /** Marcas por día: pedidos activos y días sin servicio. */
  marks: Record<ISODate, { ordered: boolean; noService: boolean }>;
}

export function WeekStrip({ days, selected, today, onSelect, marks }: WeekStripProps) {
  return (
    <div className="week-strip" role="group" aria-label="Días de la semana">
      {days.map((date) => {
        const { weekday, day } = formatDayChip(date);
        const mark = marks[date];
        const labels = [date === today ? 'hoy' : '', mark?.ordered ? 'con pedido' : '', mark?.noService ? 'sin servicio' : '']
          .filter(Boolean)
          .join(', ');
        return (
          <button
            key={date}
            type="button"
            className="week-strip__day"
            aria-pressed={date === selected}
            aria-label={`${weekday} ${day}${labels ? `, ${labels}` : ''}`}
            onClick={() => onSelect(date)}
            data-today={date === today || undefined}
          >
            <span className="week-strip__weekday">{weekday}</span>
            <span className="week-strip__num">{day}</span>
            <span className="week-strip__mark" aria-hidden="true">
              {mark?.noService ? '—' : mark?.ordered ? '●' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
