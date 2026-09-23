import { DateTime, Settings as LuxonSettings } from 'luxon';
import { LOCALE, SERVICE_CUTOFFS, TIMEZONE, type ServiceType } from '../config/business';
import type { ISODate } from '../types/models';

LuxonSettings.defaultZone = TIMEZONE;
LuxonSettings.defaultLocale = LOCALE;

/** Instante actual en la zona oficial. `nowMs` permite pruebas deterministas. */
export function nowInZone(nowMs: number = Date.now()): DateTime {
  return DateTime.fromMillis(nowMs, { zone: TIMEZONE });
}

export function todayISO(nowMs?: number): ISODate {
  return nowInZone(nowMs).toISODate()!;
}

export function parseISODate(date: ISODate): DateTime {
  const dt = DateTime.fromISO(date, { zone: TIMEZONE });
  if (!dt.isValid) throw new Error(`Fecha inválida: ${date}`);
  return dt.startOf('day');
}

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value, { zone: TIMEZONE }).isValid;
}

export function addDays(date: ISODate, days: number): ISODate {
  return parseISODate(date).plus({ days }).toISODate()!;
}

/** Lunes de la semana que contiene `date` (identificador de la semana del menú). */
export function weekStartOf(date: ISODate): ISODate {
  return parseISODate(date).startOf('week').toISODate()!;
}

/** Lunes a viernes de la semana que inicia en `weekStart`. */
export function weekdaysOf(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
}

/**
 * Semana que conviene mostrar por defecto a los padres:
 * de lunes a viernes la semana en curso; sábado y domingo, la siguiente.
 */
export function defaultWeekStart(nowMs?: number): ISODate {
  const now = nowInZone(nowMs);
  const monday = now.startOf('week');
  return (now.weekday >= 6 ? monday.plus({ weeks: 1 }) : monday).toISODate()!;
}

/** Día preseleccionado dentro de una semana: hoy si pertenece a ella, si no, el lunes. */
export function defaultDayInWeek(weekStart: ISODate, nowMs?: number): ISODate {
  const today = todayISO(nowMs);
  return weekdaysOf(weekStart).includes(today) ? today : weekStart;
}

/** Instante (UTC) en que cierran los pedidos de padres para un servicio y fecha. */
export function cutoffInstant(date: ISODate, service: ServiceType): Date {
  const { hour, minute } = SERVICE_CUTOFFS[service];
  return parseISODate(date).set({ hour, minute, second: 0, millisecond: 0 }).toJSDate();
}

/**
 * Estado abierto/cerrado SOLO para mostrar en la interfaz.
 * La protección real la hacen las reglas de Firestore con la hora del servidor.
 */
export function isBeforeCutoff(cutoff: Date, nowMs: number = Date.now()): boolean {
  return nowMs < cutoff.getTime();
}

export function formatCutoffTime(service: ServiceType): string {
  const { hour, minute } = SERVICE_CUTOFFS[service];
  return DateTime.fromObject({ hour, minute }, { zone: TIMEZONE }).toFormat('h:mm a').replace('AM', 'a. m.').replace('PM', 'p. m.');
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "martes 29 de septiembre" */
export function formatLongDate(date: ISODate): string {
  return parseISODate(date).toFormat("cccc d 'de' LLLL");
}

/** "Martes 29" */
export function formatDayTitle(date: ISODate): string {
  return capitalize(parseISODate(date).toFormat('cccc d'));
}

/** { weekday: "Lun", day: "28" } para la tira semanal. */
export function formatDayChip(date: ISODate): { weekday: string; day: string } {
  const dt = parseISODate(date);
  return { weekday: capitalize(dt.toFormat('ccc').replace('.', '')), day: dt.toFormat('d') };
}

/** "28 sep – 2 oct" */
export function formatWeekRange(weekStart: ISODate): string {
  const start = parseISODate(weekStart);
  const end = start.plus({ days: 4 });
  const fmt = (d: DateTime) => d.toFormat('d LLL').replace('.', '');
  return `${fmt(start)} – ${fmt(end)}`;
}

export { capitalize };
