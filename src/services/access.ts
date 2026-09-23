import { collection, doc, getDoc, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase/app';
import { COL, normalizeEmail } from '../firebase/paths';
import type { Family, Student } from '../types/models';

export interface AccessInfo {
  isAdmin: boolean;
  /** Familia activa autorizada para este correo verificado, o null. */
  familyId: string | null;
}

const isPermissionDenied = (err: unknown) => (err as { code?: string })?.code === 'permission-denied';

/**
 * Autorización común a Google y a correo + contraseña (misma lógica que firestore.rules):
 *  1. El correo debe estar verificado (si no, no se consulta nada).
 *  2. admins/{correo} existe → administrador (solo se crea desde la consola de Firebase).
 *  3. authorizedEmails/{correo} existe y su familia está activa → padre/madre.
 * Cada usuario solo puede leer SU documento en admins y authorizedEmails, así que la
 * tabla correo → familia nunca se expone.
 */
export async function resolveAccess(user: User): Promise<AccessInfo> {
  if (!user.emailVerified || !user.email) return { isAdmin: false, familyId: null };

  // Si el usuario acaba de verificar, el token guardado puede seguir diciendo "no verificado".
  const token = await user.getIdTokenResult();
  if (token.claims.email_verified !== true) await user.getIdToken(true);

  const id = normalizeEmail(user.email);
  const [adminSnap, accessSnap] = await Promise.all([
    getDoc(doc(db, COL.admins, id)),
    getDoc(doc(db, COL.authorizedEmails, id)),
  ]);
  const isAdmin = adminSnap.exists();
  const candidate = accessSnap.exists() ? (accessSnap.data().familyId as string) : null;
  if (!candidate) return { isAdmin, familyId: null };

  // Una familia inactiva (o inexistente) no da acceso: las reglas niegan su lectura.
  try {
    const familySnap = await getDoc(doc(db, COL.families, candidate));
    const active = familySnap.exists() && familySnap.data().active === true;
    return { isAdmin, familyId: active ? candidate : null };
  } catch (err) {
    if (isPermissionDenied(err)) return { isAdmin, familyId: null };
    throw err;
  }
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
