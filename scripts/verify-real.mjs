/**
 * Verificación de seguridad contra el Firebase REAL usando SOLO cuentas DEMO.
 *
 * - Usa la configuración pública de .env.production.local (la misma que la app).
 * - NO usa llaves de service account ni permisos de administrador.
 * - No crea datos: todas las escrituras que intenta DEBEN ser rechazadas por las reglas.
 *
 * Uso (desde la carpeta del proyecto):
 *
 *   node scripts/verify-real.mjs aislamiento
 *     Pide: cuenta verificada de "Familia Demo 1", cuenta verificada de "Familia Demo 2",
 *     cuenta SIN verificar de la Familia Demo 1 y (opcional) cuenta verificada no autorizada.
 *     Comprueba A, B, E y F del checklist (docs/PRUEBAS_FIREBASE_REAL.md).
 *
 *   node scripts/verify-real.mjs sesion-reset
 *     Prueba I: abre una sesión con una cuenta DEMO, espera a que restablezcas la
 *     contraseña desde el correo y luego comprueba qué pasa con esa sesión anterior.
 *
 * Agrega --emulador para correrlo contra los emuladores locales (pruebas del script).
 */
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { stdin, stdout, argv, exit } from 'node:process';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  query,
  setLogLevel,
  serverTimestamp,
  setDoc,
  terminate,
  where,
} from 'firebase/firestore';

const mode = argv[2];
const useEmulator = argv.includes('--emulador');

function loadConfig() {
  if (useEmulator) return { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-ijlv' };
  const file = '.env.production.local';
  if (!existsSync(file)) {
    console.error(`No existe ${file}. Ejecuta este script desde la carpeta del proyecto.`);
    exit(1);
  }
  const env = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

// Los rechazos son el resultado esperado: se ocultan los avisos internos del SDK.
setLogLevel('silent');

const config = loadConfig();
const rl = createInterface({ input: stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();
async function ask(q) {
  stdout.write(q);
  const { value, done } = await lines.next();
  if (done) throw new Error('Entrada terminada antes de tiempo.');
  if (!stdin.isTTY) stdout.write('\n');
  return value.trim();
}

let counter = 0;
const clients = [];
function client() {
  const app = initializeApp(config, `verify-${++counter}`);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {});
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  clients.push({ auth, db });
  return { auth, db };
}

const results = [];
function record(id, description, ok, detail = '') {
  results.push({ id, description, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${id} ${description}${detail ? ` — ${detail}` : ''}`);
}

/** La operación DEBE ser rechazada por las reglas. */
async function expectDenied(id, description, fn) {
  try {
    await fn();
    record(id, description, false, 'se PERMITIÓ (debía rechazarse)');
  } catch (err) {
    const code = err?.code ?? String(err);
    record(id, description, code === 'permission-denied', code === 'permission-denied' ? 'rechazado' : `error inesperado: ${code}`);
  }
}

/** La operación DEBE permitirse. Devuelve su resultado. */
async function expectAllowed(id, description, fn) {
  try {
    const value = await fn();
    record(id, description, true, 'permitido');
    return value;
  } catch (err) {
    record(id, description, false, `rechazado: ${err?.code ?? err}`);
    return undefined;
  }
}

async function signIn(label) {
  const email = (await ask(`Correo de ${label}: `)).toLowerCase();
  const password = await ask(`Contraseña de ${label}: `);
  const c = client();
  const cred = await signInWithEmailAndPassword(c.auth, email, password);
  console.log(`   → sesión iniciada (${email}); correo verificado: ${cred.user.emailVerified ? 'sí' : 'NO'}`);
  return { ...c, email, user: cred.user };
}

async function familyOf(c) {
  const snap = await getDoc(doc(c.db, 'authorizedEmails', c.email));
  if (!snap.exists()) throw new Error(`${c.email} no está autorizado en ninguna familia`);
  const familyId = snap.data().familyId;
  const students = await getDocs(query(collection(c.db, 'students'), where('familyId', '==', familyId)));
  return { familyId, students: students.docs.map((d) => ({ id: d.id, name: d.data().name })) };
}

function forgedOrder(c, studentId, studentName, familyId) {
  const date = '2099-01-05';
  return {
    ref: doc(c.db, 'orders', `${date}_${studentId}_lunch`),
    data: {
      date,
      studentId,
      studentName,
      familyId,
      service: 'lunch',
      priceAtOrder: 70,
      status: 'active',
      paymentStatus: 'pending',
      source: 'parent',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: c.user.uid,
      updatedBy: c.user.uid,
    },
  };
}

async function aislamiento() {
  console.log('\n== Cuentas DEMO (se usan solo para leer; ninguna escritura debe permitirse) ==\n');
  const a = await signIn('Familia Demo 1 (VERIFICADA)');
  const b = await signIn('Familia Demo 2 (VERIFICADA)');
  const u = await signIn('Familia Demo 1 SIN VERIFICAR');

  console.log('\n-- B. Cuenta verificada y autorizada: solo su familia --');
  const famA = await expectAllowed('B1', 'Demo 1 lee su autorización y sus hijos', () => familyOf(a));
  const famB = await expectAllowed('B2', 'Demo 2 lee su autorización y sus hijos', () => familyOf(b));
  if (!famA || !famB) {
    console.log('\nNo se pudieron leer las familias DEMO; revisa que los correos estén dados de alta y verificados.');
    return;
  }
  console.log(`   Demo 1: ${famA.students.map((s) => s.name).join(', ')} · Demo 2: ${famB.students.map((s) => s.name).join(', ')}`);
  await expectAllowed('B3', 'Demo 1 lee su familia', () => getDoc(doc(a.db, 'families', famA.familyId)));
  await expectAllowed('B4', 'Demo 1 lee sus pedidos', () =>
    getDocs(query(collection(a.db, 'orders'), where('familyId', '==', famA.familyId))),
  );

  console.log('\n-- A. Cuenta de la familia SIN verificar --');
  await expectDenied('A1', 'no lee su autorización', () => getDoc(doc(u.db, 'authorizedEmails', u.email)));
  await expectDenied('A2', 'no lee la familia', () => getDoc(doc(u.db, 'families', famA.familyId)));
  await expectDenied('A3', 'no lee los hijos', () =>
    getDocs(query(collection(u.db, 'students'), where('familyId', '==', famA.familyId))),
  );
  await expectDenied('A4', 'no lee pedidos ni pagos', () =>
    getDocs(query(collection(u.db, 'orders'), where('familyId', '==', famA.familyId))),
  );
  const own = famA.students[0];
  const orderU = forgedOrder(u, own.id, own.name, famA.familyId);
  await expectDenied('A5', 'no puede crear pedidos', () => setDoc(orderU.ref, orderU.data));

  console.log('\n-- E. Familia Demo 1 no puede consultar Familia Demo 2 --');
  const other = famB.students[0];
  await expectDenied('E1', 'no lee la familia 2', () => getDoc(doc(a.db, 'families', famB.familyId)));
  await expectDenied('E2', 'no lee los hijos de la familia 2', () =>
    getDocs(query(collection(a.db, 'students'), where('familyId', '==', famB.familyId))),
  );
  await expectDenied('E3', 'no lee un alumno de la familia 2 por su ID', () => getDoc(doc(a.db, 'students', other.id)));
  await expectDenied('E4', 'no lee pedidos de la familia 2', () =>
    getDocs(query(collection(a.db, 'orders'), where('familyId', '==', famB.familyId))),
  );
  await expectDenied('E5', 'no lista la tabla de correos autorizados', () => getDocs(collection(a.db, 'authorizedEmails')));
  await expectDenied('E6', 'no lee el correo autorizado de otra familia', () =>
    getDoc(doc(a.db, 'authorizedEmails', b.email)),
  );
  await expectDenied('E7', 'no lista familias', () => getDocs(collection(a.db, 'families')));
  await expectDenied('E8', 'no puede crearse administrador', () =>
    setDoc(doc(a.db, 'admins', a.email), { createdAt: serverTimestamp() }),
  );

  console.log('\n-- F. Familia Demo 1 no puede pedir para un alumno de la Familia Demo 2 --');
  const f1 = forgedOrder(a, other.id, other.name, famB.familyId);
  await expectDenied('F1', 'pedido declarando la familia 2', () => setDoc(f1.ref, f1.data));
  const f2 = forgedOrder(a, other.id, other.name, famA.familyId);
  await expectDenied('F2', 'pedido declarando su propia familia', () => setDoc(f2.ref, f2.data));

  const extra = await ask('\n¿Probar también una cuenta verificada NO autorizada? (s/n): ');
  if (extra.toLowerCase().startsWith('s')) {
    const x = await signIn('cuenta verificada NO autorizada');
    console.log('\n-- D. Cuenta verificada sin familia --');
    await expectDenied('D1', 'no lee la familia 1', () => getDoc(doc(x.db, 'families', famA.familyId)));
    await expectDenied('D2', 'no lee hijos de la familia 1', () =>
      getDocs(query(collection(x.db, 'students'), where('familyId', '==', famA.familyId))),
    );
    await expectDenied('D3', 'no lee el menú ni los precios', () => getDoc(doc(x.db, 'settings', 'app')));
  }
}

async function sesionReset() {
  console.log('\n== Prueba I: sesión anterior tras restablecer la contraseña ==');
  console.log('Usa una cuenta DEMO de correo y contraseña (nunca la de un padre real).\n');
  const s = await signIn('la cuenta DEMO');
  const before = await s.user.getIdTokenResult();
  console.log(`   Token actual: verificado=${before.claims.email_verified}, emitido=${before.issuedAtTime}`);

  console.log(`
AHORA, sin cerrar esta ventana:
  1. En tu navegador abre https://ijlv-comidas.web.app → Entrar con correo → Olvidé mi contraseña.
  2. Escribe ${s.email} y envía.
  3. Abre el correo recibido, toca el enlace y crea una contraseña NUEVA.
  4. (Si la app te lo pide, verifica el correo.)
`);
  await ask('Cuando termines, presiona Enter aquí… ');

  let refreshed = null;
  try {
    const t = await s.user.getIdTokenResult(true);
    refreshed = t;
    record('I1', 'la sesión anterior NO debe poder renovarse', false, `se renovó (verificado=${t.claims.email_verified})`);
  } catch (err) {
    record('I1', 'la sesión anterior NO debe poder renovarse', true, `rechazada: ${err?.code ?? err}`);
  }
  await expectDenied('I2', 'la sesión anterior no lee datos familiares', async () => {
    const snap = await getDoc(doc(s.db, 'authorizedEmails', s.email));
    if (!snap.exists()) throw Object.assign(new Error('sin autorización'), { code: 'permission-denied' });
    return getDocs(query(collection(s.db, 'students'), where('familyId', '==', snap.data().familyId)));
  });
  if (refreshed) {
    console.log('\n⚠️  Firebase permitió renovar la sesión anterior. Anota este resultado y avísale al equipo técnico.');
  }
}

try {
  if (mode === 'aislamiento') await aislamiento();
  else if (mode === 'sesion-reset') await sesionReset();
  else {
    console.log('Uso: node scripts/verify-real.mjs aislamiento | sesion-reset [--emulador]');
    exit(1);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nResultado: ${results.length - failed.length}/${results.length} comprobaciones correctas.`);
  if (failed.length) console.log('Fallaron: ' + failed.map((f) => f.id).join(', '));
  process.exitCode = failed.length ? 1 : 0;
} catch (err) {
  console.error('\nError:', err?.code ?? err?.message ?? err);
  process.exitCode = 1;
} finally {
  rl.close();
  await Promise.all(clients.map((c) => signOut(c.auth).catch(() => {})));
  await Promise.all(clients.map((c) => terminate(c.db).catch(() => {})));
}
