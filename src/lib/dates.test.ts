import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  addDays,
  cutoffInstant,
  defaultDayInWeek,
  defaultWeekStart,
  isBeforeCutoff,
  todayISO,
  weekdaysOf,
  weekStartOf,
} from './dates';

const mx = (iso: string) => DateTime.fromISO(iso, { zone: 'America/Mexico_City' }).toMillis();

describe('cutoffs en America/Mexico_City', () => {
  const date = '2026-09-29';

  it('09:59:59 → desayuno disponible', () => {
    expect(isBeforeCutoff(cutoffInstant(date, 'breakfast'), mx('2026-09-29T09:59:59'))).toBe(true);
  });

  it('10:00:00 → desayuno bloqueado', () => {
    expect(isBeforeCutoff(cutoffInstant(date, 'breakfast'), mx('2026-09-29T10:00:00'))).toBe(false);
  });

  it('10:59:59 → comida disponible', () => {
    expect(isBeforeCutoff(cutoffInstant(date, 'lunch'), mx('2026-09-29T10:59:59'))).toBe(true);
  });

  it('11:00:00 → comida bloqueada', () => {
    expect(isBeforeCutoff(cutoffInstant(date, 'lunch'), mx('2026-09-29T11:00:00'))).toBe(false);
  });

  it('el cierre es un instante absoluto (16:00 UTC, México no usa horario de verano)', () => {
    expect(cutoffInstant(date, 'breakfast').toISOString()).toBe('2026-09-29T16:00:00.000Z');
    expect(cutoffInstant('2027-01-15', 'lunch').toISOString()).toBe('2027-01-15T17:00:00.000Z');
  });

  it('un día futuro sigue abierto aunque hoy ya haya cerrado', () => {
    expect(isBeforeCutoff(cutoffInstant('2026-09-30', 'breakfast'), mx('2026-09-29T12:00:00'))).toBe(true);
  });
});

describe('fechas locales', () => {
  it('todayISO usa la zona de México y no UTC', () => {
    // 23:30 del 28 en México = 05:30 UTC del 29
    expect(todayISO(mx('2026-09-28T23:30:00'))).toBe('2026-09-28');
  });

  it('semanas de lunes a viernes', () => {
    expect(weekStartOf('2026-10-01')).toBe('2026-09-28');
    expect(weekdaysOf('2026-09-28')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(addDays('2026-09-30', 3)).toBe('2026-10-03');
  });

  it('en fin de semana se muestra la semana siguiente', () => {
    expect(defaultWeekStart(mx('2026-09-27T10:00:00'))).toBe('2026-09-28'); // domingo
    expect(defaultWeekStart(mx('2026-09-30T10:00:00'))).toBe('2026-09-28'); // miércoles
  });

  it('día por defecto: hoy si está en la semana, si no el lunes', () => {
    expect(defaultDayInWeek('2026-09-28', mx('2026-09-30T08:00:00'))).toBe('2026-09-30');
    expect(defaultDayInWeek('2026-09-28', mx('2026-09-27T08:00:00'))).toBe('2026-09-28');
  });
});

describe('shiftWeekday', () => {
  it('salta el fin de semana', async () => {
    const { shiftWeekday } = await import('./dates');
    expect(shiftWeekday('2026-10-02', 1)).toBe('2026-10-05');
    expect(shiftWeekday('2026-10-05', -1)).toBe('2026-10-02');
    expect(shiftWeekday('2026-09-29', 1)).toBe('2026-09-30');
  });
});
