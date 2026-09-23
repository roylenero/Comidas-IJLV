import { doc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/app';
import { COL, SETTINGS_DOC_ID } from '../firebase/paths';
import type { ServiceType, Settings } from '../types/models';
import { serverWrite } from './serverWrite';

const settingsRef = () => doc(db, COL.settings, SETTINGS_DOC_ID);

export function watchSettings(onData: (s: Settings | null) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(settingsRef(), (snap) => onData(snap.exists() ? (snap.data() as Settings) : null), onError);
}

export function savePrices(prices: Record<ServiceType, number>): Promise<void> {
  return serverWrite(async (tx) => {
    tx.set(settingsRef(), { prices, updatedAt: serverTimestamp() });
  });
}
