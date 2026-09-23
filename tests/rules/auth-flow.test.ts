/**
 * Flujo real de correo + contraseña contra los emuladores de Auth y Firestore,
 * con el SDK web real (tokens emitidos por el emulador de Auth, no simulados).
 * Ejecutar con: npm run test:rules
 *
 * Cubre: cuenta sin verificar sin acceso, activación con verificación, correo no
 * registrado, suplantación (alguien crea antes la cuenta con el correo de un padre)
 * y cambio de correo.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  applyActionCode,
  confirmPasswordReset,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  verifyBeforeUpdateEmail,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  query,
  setDoc,
  terminate,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-ijlv';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

const FAMILY_EMAIL = 'papa.real@demo.test';
const SECOND_FAMILY_EMAIL = 'mama.real@demo.test';
const OTHER_FAMILY_EMAIL = 'otra.familia@demo.test';
const UNREGISTERED_EMAIL = 'nadie@demo.test';

let env: RulesTestEnvironment;
const apps: FirebaseApp[] = [];
const dbs: Firestore[] = [];

/** Un "dispositivo" independiente (cada uno con su propia sesión). */
function device(name: string): { auth: Auth; db: Firestore } {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT_ID, authDomain: 'localhost' }, `${name}-${Math.random()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db = initializeFirestore(app, {});
  const [host, port] = FIRESTORE_HOST.split(':');
  connectFirestoreEmulator(db, host, Number(port));
  dbs.push(db);
  return { auth, db };
}

interface OobCode {
  email: string;
  requestType: string;
  oobCode: string;
  newEmail?: string;
}

/** Lee del emulador los enlaces "enviados por correo" (equivale a abrir el buzón). */
async function mailbox(email: string, requestType: string): Promise<string> {
  const res = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
  const matches = oobCodes.filter((c) => c.email === email && c.requestType === requestType);
  if (!matches.length) throw new Error(`No hay correo ${requestType} para ${email}`);
  return matches[matches.length - 1].oobCode;
}

const readStudents = (db: Firestore, familyId: string) =>
  getDocs(query(collection(db, 'students'), where('familyId', '==', familyId)));

async function denied(p: Promise<unknown>) {
  await expect(p).rejects.toMatchObject({ code: 'permission-denied' });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

beforeEach(async () => {
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/oobCodes`, { method: 'DELETE' }).catch(() => {});
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const now = Timestamp.now();
    await setDoc(doc(db, 'families', 'fam-real'), { name: 'Familia Demo Real', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'families', 'fam-otra'), { name: 'Familia Demo Otra', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'authorizedEmails', FAMILY_EMAIL), { familyId: 'fam-real', createdAt: now });
    await setDoc(doc(db, 'authorizedEmails', SECOND_FAMILY_EMAIL), { familyId: 'fam-real', createdAt: now });
    await setDoc(doc(db, 'authorizedEmails', OTHER_FAMILY_EMAIL), { familyId: 'fam-otra', createdAt: now });
    await setDoc(doc(db, 'students', 'hijo-real'), { name: 'Hijo Demo', familyId: 'fam-real', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'students', 'hijo-otra'), { name: 'Otro Demo', familyId: 'fam-otra', active: true, createdAt: now, updatedAt: now });
  });
});

afterAll(async () => {
  await Promise.all(dbs.map((db) => terminate(db).catch(() => {})));
  await Promise.all(apps.map((app) => deleteApp(app).catch(() => {})));
  await env?.cleanup();
});

describe('Correo + contraseña con el emulador de Auth real', () => {
  it('primera activación: sin verificar no ve nada; tras verificar ve solo su familia', async () => {
    const { auth, db } = device('padre');
    const cred = await createUserWithEmailAndPassword(auth, SECOND_FAMILY_EMAIL, 'contrasena-segura');
    await sendEmailVerification(cred.user);
    expect(cred.user.emailVerified).toBe(false);

    await denied(getDoc(doc(db, 'authorizedEmails', SECOND_FAMILY_EMAIL)));
    await denied(getDoc(doc(db, 'families', 'fam-real')));
    await denied(readStudents(db, 'fam-real'));

    // El padre abre el enlace del correo y luego toca "Ya verifiqué mi correo".
    await applyActionCode(auth, await mailbox(SECOND_FAMILY_EMAIL, 'VERIFY_EMAIL'));
    await cred.user.reload();
    expect(cred.user.emailVerified).toBe(true);
    await cred.user.getIdToken(true);

    expect((await getDoc(doc(db, 'authorizedEmails', SECOND_FAMILY_EMAIL))).data()?.familyId).toBe('fam-real');
    expect((await readStudents(db, 'fam-real')).size).toBe(1);
    await denied(readStudents(db, 'fam-otra'));
    await denied(getDoc(doc(db, 'students', 'hijo-otra')));
  });

  it('correo verificado pero no registrado por el IJLV: no obtiene datos familiares', async () => {
    const { auth, db } = device('desconocido');
    const cred = await createUserWithEmailAndPassword(auth, UNREGISTERED_EMAIL, 'contrasena-segura');
    await sendEmailVerification(cred.user);
    await applyActionCode(auth, await mailbox(UNREGISTERED_EMAIL, 'VERIFY_EMAIL'));
    await cred.user.reload();
    await cred.user.getIdToken(true);
    expect(cred.user.emailVerified).toBe(true);

    // Puede comprobar SU documento (no existe) y nada más.
    expect((await getDoc(doc(db, 'authorizedEmails', UNREGISTERED_EMAIL))).exists()).toBe(false);
    await denied(getDoc(doc(db, 'authorizedEmails', FAMILY_EMAIL)));
    await denied(getDocs(collection(db, 'authorizedEmails')));
    await denied(readStudents(db, 'fam-real'));
    await denied(getDoc(doc(db, 'families', 'fam-real')));
  });

  it('suplantación: un tercero se adelanta a crear la cuenta; no ve nada y el dueño lo expulsa con "Olvidé mi contraseña"', async () => {
    // 1. El atacante conoce el correo del padre y crea la cuenta con SU contraseña.
    const attacker = device('atacante');
    const hijacked = await createUserWithEmailAndPassword(attacker.auth, FAMILY_EMAIL, 'contrasena-del-atacante');
    expect(hijacked.user.emailVerified).toBe(false);
    await denied(getDoc(doc(attacker.db, 'families', 'fam-real')));
    await denied(readStudents(attacker.db, 'fam-real'));
    await denied(getDoc(doc(attacker.db, 'students', 'hijo-real')));
    await denied(getDoc(doc(attacker.db, 'authorizedEmails', FAMILY_EMAIL)));

    // 2. El padre real intenta "Crear contraseña": el correo ya existe, así que usa
    //    "Olvidé mi contraseña" y abre el enlace en SU buzón.
    const owner = device('padre-real');
    await expect(createUserWithEmailAndPassword(owner.auth, FAMILY_EMAIL, 'contrasena-del-padre')).rejects.toMatchObject({
      code: 'auth/email-already-in-use',
    });
    await sendPasswordResetEmail(owner.auth, FAMILY_EMAIL);
    await confirmPasswordReset(owner.auth, await mailbox(FAMILY_EMAIL, 'PASSWORD_RESET'), 'contrasena-del-padre');

    // 3. La contraseña del atacante deja de servir.
    await expect(signInWithEmailAndPassword(device('atacante-2').auth, FAMILY_EMAIL, 'contrasena-del-atacante')).rejects.toMatchObject({
      code: expect.stringMatching(/auth\/(wrong-password|invalid-credential)/),
    });

    // 4. El padre entra; si aún no está verificado, verifica desde su buzón.
    const session = await signInWithEmailAndPassword(owner.auth, FAMILY_EMAIL, 'contrasena-del-padre');
    if (!session.user.emailVerified) {
      await sendEmailVerification(session.user);
      await applyActionCode(owner.auth, await mailbox(FAMILY_EMAIL, 'VERIFY_EMAIL'));
      await session.user.reload();
    }
    await session.user.getIdToken(true);
    expect((await readStudents(owner.db, 'fam-real')).size).toBe(1);
  });

  it('suplantación: la sesión que el atacante ya tenía abierta sigue sin acceso cuando el dueño verifica', async () => {
    const attacker = device('atacante');
    await createUserWithEmailAndPassword(attacker.auth, FAMILY_EMAIL, 'contrasena-del-atacante');

    const owner = device('padre-real');
    await sendPasswordResetEmail(owner.auth, FAMILY_EMAIL);
    await confirmPasswordReset(owner.auth, await mailbox(FAMILY_EMAIL, 'PASSWORD_RESET'), 'contrasena-del-padre');
    const session = await signInWithEmailAndPassword(owner.auth, FAMILY_EMAIL, 'contrasena-del-padre');
    // Abrir el enlace de "Olvidé mi contraseña" prueba que el buzón es suyo: queda verificado.
    expect(session.user.emailVerified).toBe(true);

    // El token que el atacante ya tiene dice "no verificado": sigue sin acceso.
    await denied(readStudents(attacker.db, 'fam-real'));
    await denied(getDoc(doc(attacker.db, 'families', 'fam-real')));

    // IMPORTANTE: en Firebase real, cambiar la contraseña REVOCA las sesiones anteriores,
    // así que el atacante tampoco puede renovar su token. El emulador NO implementa esa
    // revocación, por eso no se prueba aquí: está en la lista de verificación manual
    // (README → "Prueba obligatoria en Firebase real").
  });

  it('cambio de correo: al cambiar a un correo no autorizado pierde el acceso a su familia', async () => {
    const { auth, db } = device('padre');
    const cred = await createUserWithEmailAndPassword(auth, SECOND_FAMILY_EMAIL, 'contrasena-segura');
    await sendEmailVerification(cred.user);
    await applyActionCode(auth, await mailbox(SECOND_FAMILY_EMAIL, 'VERIFY_EMAIL'));
    await cred.user.reload();
    await cred.user.getIdToken(true);
    expect((await readStudents(db, 'fam-real')).size).toBe(1);

    await verifyBeforeUpdateEmail(cred.user, 'correo.nuevo@demo.test');
    await applyActionCode(auth, await mailbox(SECOND_FAMILY_EMAIL, 'VERIFY_AND_CHANGE_EMAIL'));

    const again = device('padre-otra-vez');
    await signInWithEmailAndPassword(again.auth, 'correo.nuevo@demo.test', 'contrasena-segura');
    await denied(readStudents(again.db, 'fam-real'));
    await denied(getDoc(doc(again.db, 'families', 'fam-real')));
  });
});
