import { collection, doc, getDoc, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/app';
import { COL, normalizeEmail } from '../firebase/paths';
import type { Family, Student } from '../types/models';

export interface AccessInfo {
  isAdmin: boolean;
  familyId: string | null;
}

/**
 * Determina el rol a partir del correo verificado.
 * - admins/{email} existe → administrador (solo se crea desde la consola de Firebase).
 * - authorizedEmails/{email} existe → padre/madre de esa familia.
 * Las reglas permiten a cada usuario leer únicamente SU documento en ambas colecciones.
 */
export async function resolveAccess(email: string): Promise<AccessInfo> {
  const id = normalizeEmail(email);
  const [adminSnap, accessSnap] = await Promise.all([
    getDoc(doc(db, COL.admins, id)),
    getDoc(doc(db, COL.authorizedEmails, id)),
  ]);
  const familyId = accessSnap.exists() ? (accessSnap.data().familyId as string) : null;
  return { isAdmin: adminSnap.exists(), familyId };
}

export function watchFamily(familyId: string, onData: (family: Family | null) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, COL.families, familyId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as Family) : null),
    onError,
  );
}

export function watchFamilyStudents(
  familyId: string,
  onData: (students: Student[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL.students), where('familyId', '==', familyId)),
    (snap) => {
      const students = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Student)
        .filter((s) => s.active)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      onData(students);
    },
    onError,
  );
}
