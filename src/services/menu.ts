import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, Timestamp, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/app';
import { COL } from '../firebase/paths';
import { cutoffInstant, weekStartOf } from '../lib/dates';
import type { ISODate, MenuAsset, MenuDay, MenuWeek, ServiceType } from '../types/models';

import { serverWrite } from './serverWrite';

export interface ServiceDraft {
  available: boolean;
  description: string;
}

export interface DayDraft {
  date: ISODate;
  noService: boolean;
  breakfast: ServiceDraft;
  lunch: ServiceDraft;
}

export function watchMenuWeek(weekId: ISODate, onData: (w: MenuWeek | null) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, COL.menuWeeks, weekId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as MenuWeek) : null),
    onError,
  );
}

export function watchMenuDays(weekId: ISODate, onData: (days: MenuDay[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL.menuDays), where('weekId', '==', weekId)),
    (snap) => onData(snap.docs.map((d) => d.data() as MenuDay).sort((a, b) => a.date.localeCompare(b.date))),
    onError,
  );
}

export function watchMenuDay(date: ISODate, onData: (d: MenuDay | null) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, COL.menuDays, date), (snap) => onData(snap.exists() ? (snap.data() as MenuDay) : null), onError);
}

export async function getMenuAsset(weekId: ISODate): Promise<MenuAsset | null> {
  const snap = await getDoc(doc(db, COL.menuAssets, weekId));
  return snap.exists() ? (snap.data() as MenuAsset) : null;
}

/** Construye el documento del día con el instante de cierre calculado en America/Mexico_City. */
export function buildMenuDay(draft: DayDraft) {
  const service = (type: ServiceType) => ({
    available: draft[type].available,
    description: draft[type].description.trim(),
    cutoffAt: Timestamp.fromDate(cutoffInstant(draft.date, type)),
  });
  return {
    date: draft.date,
    weekId: weekStartOf(draft.date),
    noService: draft.noService,
    breakfast: service('breakfast'),
    lunch: service('lunch'),
    updatedAt: serverTimestamp(),
  };
}

/** Guarda los días de la semana (y crea el documento de la semana si no existe). */
export function saveWeek(weekId: ISODate, days: DayDraft[]): Promise<void> {
  return serverWrite(async (tx) => {
    const weekRef = doc(db, COL.menuWeeks, weekId);
    const weekSnap = await tx.get(weekRef);
    const current = weekSnap.exists() ? (weekSnap.data() as MenuWeek) : null;
    tx.set(weekRef, {
      weekStart: weekId,
      hasImage: current?.hasImage ?? false,
      imageUpdatedAt: current?.imageUpdatedAt ?? null,
      updatedAt: serverTimestamp(),
    });
    for (const day of days) tx.set(doc(db, COL.menuDays, day.date), buildMenuDay(day));
  });
}

export function saveMenuImage(weekId: ISODate, asset: MenuAsset): Promise<void> {
  return serverWrite(async (tx) => {
    tx.set(doc(db, COL.menuAssets, weekId), { ...asset, updatedAt: serverTimestamp() });
    tx.set(doc(db, COL.menuWeeks, weekId), {
      weekStart: weekId,
      hasImage: true,
      imageUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export function removeMenuImage(weekId: ISODate): Promise<void> {
  return serverWrite(async (tx) => {
    tx.delete(doc(db, COL.menuAssets, weekId));
    tx.set(doc(db, COL.menuWeeks, weekId), {
      weekStart: weekId,
      hasImage: false,
      imageUpdatedAt: null,
      updatedAt: serverTimestamp(),
    });
  });
}

/** Día vacío para el editor. */
export function emptyDayDraft(date: ISODate): DayDraft {
  return {
    date,
    noService: false,
    breakfast: { available: true, description: '' },
    lunch: { available: true, description: '' },
  };
}

export function draftFromMenuDay(day: MenuDay): DayDraft {
  const pick = (t: ServiceType) => ({ available: day[t].available, description: day[t].description });
  return { date: day.date, noService: day.noService, breakfast: pick('breakfast'), lunch: pick('lunch') };
}

