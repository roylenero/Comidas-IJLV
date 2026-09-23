import { collection, doc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/app';
import { COL, normalizeEmail } from '../firebase/paths';
import { AppError } from '../lib/errors';
import { cleanName, type ImportPlan } from '../lib/importPlan';
import type { AuthorizedEmail, Family, Student } from '../types/models';
import { serverWrite } from './serverWrite';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function byName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name, 'es');
}

export function watchFamilies(onData: (f: Family[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    collection(db, COL.families),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Family).sort(byName)),
    onError,
  );
}

export function watchAllStudents(onData: (s: Student[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    collection(db, COL.students),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Student).sort(byName)),
    onError,
  );
}

export function watchAuthorizedEmails(onData: (e: AuthorizedEmail[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    collection(db, COL.authorizedEmails),
    (snap) => onData(snap.docs.map((d) => ({ email: d.id, familyId: d.data().familyId as string }))),
    onError,
  );
}

function validEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!EMAIL_RE.test(email)) throw new AppError('validation', `"${raw}" no es un correo válido.`);
  return email;
}

function validName(raw: string, what: string): string {
  const name = cleanName(raw);
  if (!name) throw new AppError('validation', `Escribe el nombre ${what}.`);
  if (name.length > 120) throw new AppError('validation', `El nombre ${what} es demasiado largo.`);
  return name;
}

export interface NewFamilyInput {
  name: string;
  emails: string[];
  studentNames: string[];
}

export function createFamily(input: NewFamilyInput): Promise<string> {
  const name = validName(input.name, 'de la familia');
  const emails = [...new Set(input.emails.map(validEmail))];
  const students = input.studentNames.map((n) => cleanName(n)).filter(Boolean);
  return serverWrite(async (tx) => {
    const emailSnaps = await Promise.all(emails.map((e) => tx.get(doc(db, COL.authorizedEmails, e))));
    const taken = emailSnaps.filter((s) => s.exists()).map((s) => s.id);
    if (taken.length) throw new AppError('validation', `Estos correos ya están asignados a otra familia: ${taken.join(', ')}`);

    const familyRef = doc(collection(db, COL.families));
    tx.set(familyRef, { name, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    for (const email of emails) tx.set(doc(db, COL.authorizedEmails, email), { familyId: familyRef.id, createdAt: serverTimestamp() });
    for (const student of students) {
      tx.set(doc(collection(db, COL.students)), {
        name: validName(student, 'del alumno'),
        familyId: familyRef.id,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return familyRef.id;
  });
}

export function updateFamily(id: string, data: { name: string; active: boolean }): Promise<void> {
  const name = validName(data.name, 'de la familia');
  return serverWrite(async (tx) => {
    tx.update(doc(db, COL.families, id), { name, active: data.active, updatedAt: serverTimestamp() });
  });
}

export function addAuthorizedEmail(familyId: string, rawEmail: string): Promise<void> {
  const email = validEmail(rawEmail);
  return serverWrite(async (tx) => {
    const ref = doc(db, COL.authorizedEmails, email);
    const snap = await tx.get(ref);
    if (snap.exists()) {
      if (snap.data().familyId === familyId) return;
      throw new AppError('validation', `El correo ${email} ya está asignado a otra familia.`);
    }
    tx.set(ref, { familyId, createdAt: serverTimestamp() });
  });
}

export function removeAuthorizedEmail(email: string): Promise<void> {
  return serverWrite(async (tx) => {
    tx.delete(doc(db, COL.authorizedEmails, email));
  });
}

export function addStudent(familyId: string, rawName: string): Promise<void> {
  const name = validName(rawName, 'del alumno');
  return serverWrite(async (tx) => {
    tx.set(doc(collection(db, COL.students)), {
      name,
      familyId,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export function updateStudent(id: string, data: { name: string; active: boolean }): Promise<void> {
  const name = validName(data.name, 'del alumno');
  return serverWrite(async (tx) => {
    tx.update(doc(db, COL.students, id), { name, active: data.active, updatedAt: serverTimestamp() });
  });
}

/** Aplica un plan de importación CSV en una sola transacción (todo o nada). */
export function applyImportPlan(plan: ImportPlan): Promise<{ families: number; students: number; emails: number }> {
  const writes = plan.families.reduce((n, f) => n + 1 + f.newEmails.length + f.newStudents.length, 0);
  if (writes > 450) {
    throw new AppError('validation', 'El archivo es demasiado grande para una sola carga. Divídelo en dos archivos.');
  }
  return serverWrite(async (tx) => {
    const allEmails = plan.families.flatMap((f) => f.newEmails);
    const snaps = await Promise.all(allEmails.map((e) => tx.get(doc(db, COL.authorizedEmails, e))));
    const taken = snaps.filter((s) => s.exists()).map((s) => s.id);
    if (taken.length) throw new AppError('validation', `Estos correos ya fueron asignados: ${taken.join(', ')}. Vuelve a cargar el archivo.`);

    let families = 0;
    let students = 0;
    for (const f of plan.families) {
      let familyId = f.existingId;
      if (!familyId) {
        const ref = doc(collection(db, COL.families));
        familyId = ref.id;
        tx.set(ref, { name: f.name, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        families++;
      }
      for (const email of f.newEmails) tx.set(doc(db, COL.authorizedEmails, email), { familyId, createdAt: serverTimestamp() });
      for (const name of f.newStudents) {
        tx.set(doc(collection(db, COL.students)), {
          name,
          familyId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        students++;
      }
    }
    return { families, students, emails: allEmails.length };
  });
}
