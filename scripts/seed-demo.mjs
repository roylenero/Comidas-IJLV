/**
 * Carga datos DEMO en Firebase Emulator Suite (NUNCA en producción).
 *
 *   npm run emulators        (en otra terminal)
 *   npm run seed:demo
 *
 * Crea cuentas de prueba (contraseña: demo1234):
 *   admin.demo@ijlv.test      → administrador
 *   familia1.demo@ijlv.test   → Familia Demo 1 (Mateo Demo, Sofía Demo)
 *   familia2.demo@ijlv.test   → Familia Demo 2 (Lucía Demo)
 *   sinalumnos.demo@ijlv.test → correo verificado sin alumnos (pantalla "sin acceso")
 *   sinverificar.demo@ijlv.test → correo de la Familia Demo 1 SIN verificar
 *                                 (pantalla "Verifica tu correo"; no ve ningún dato)
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';

if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-ijlv';
if (!PROJECT_ID.startsWith('demo-')) {
  console.error('Por seguridad este script solo funciona con proyectos "demo-*" del emulador.');
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const ZONE = 'America/Mexico_City';
const PASSWORD = 'demo1234';

const USERS = [
  { email: 'admin.demo@ijlv.test', name: 'Administración DEMO' },
  { email: 'familia1.demo@ijlv.test', name: 'Familia Demo 1' },
  { email: 'familia2.demo@ijlv.test', name: 'Familia Demo 2' },
  { email: 'sinalumnos.demo@ijlv.test', name: 'Sin alumnos DEMO' },
  { email: 'sinverificar.demo@ijlv.test', name: 'Sin verificar DEMO', emailVerified: false },
];

const MENUS = [
  ['Molletes con frijoles y pico de gallo DEMO\nFruta de temporada', 'Sopa de fideo DEMO\nTinga de pollo con arroz\nAgua de jamaica'],
  ['Hot cakes con fruta DEMO\nLeche o chocolate', 'Crema de calabaza DEMO\nAlbóndigas en chipotle\nAgua de limón'],
  ['Chilaquiles verdes DEMO\nJugo de naranja', 'Arroz rojo DEMO\nPescado empanizado con ensalada\nAgua de horchata'],
  ['Avena con plátano DEMO\nPan tostado', 'Consomé de pollo DEMO\nEnchiladas suizas\nAgua de piña'],
  ['Sincronizadas DEMO\nFruta picada', 'Pasta a la boloñesa DEMO\nEnsalada verde\nAgua de melón'],
];

async function upsertUser({ email, name, emailVerified = true }) {
  try {
    const u = await auth.getUserByEmail(email);
    return u.uid;
  } catch {
    const u = await auth.createUser({ email, password: PASSWORD, displayName: name, emailVerified });
    return u.uid;
  }
}

function cutoff(date, hour) {
  return Timestamp.fromDate(DateTime.fromISO(date, { zone: ZONE }).set({ hour, minute: 0, second: 0, millisecond: 0 }).toJSDate());
}

async function main() {
  const uids = {};
  for (const u of USERS) uids[u.email] = await upsertUser(u);

  const now = Timestamp.now();
  const batch = db.batch();
  batch.set(db.doc('admins/admin.demo@ijlv.test'), { createdAt: now, note: 'DEMO' });
  batch.set(db.doc('settings/app'), { prices: { breakfast: 55, lunch: 70 }, updatedAt: now });

  batch.set(db.doc('families/demo-fam-1'), { name: 'Familia Demo 1', active: true, createdAt: now, updatedAt: now });
  batch.set(db.doc('families/demo-fam-2'), { name: 'Familia Demo 2', active: true, createdAt: now, updatedAt: now });
  batch.set(db.doc('authorizedEmails/familia1.demo@ijlv.test'), { familyId: 'demo-fam-1', createdAt: now });
  batch.set(db.doc('authorizedEmails/familia2.demo@ijlv.test'), { familyId: 'demo-fam-2', createdAt: now });
  batch.set(db.doc('authorizedEmails/sinverificar.demo@ijlv.test'), { familyId: 'demo-fam-1', createdAt: now });
  // El admin DEMO también es tutor de la Familia Demo 2, para probar "Vista familia".
  batch.set(db.doc('authorizedEmails/admin.demo@ijlv.test'), { familyId: 'demo-fam-2', createdAt: now });
  const students = [
    ['demo-mateo', 'Mateo Demo', 'demo-fam-1'],
    ['demo-sofia', 'Sofía Demo', 'demo-fam-1'],
    ['demo-lucia', 'Lucía Demo', 'demo-fam-2'],
  ];
  for (const [id, name, familyId] of students) {
    batch.set(db.doc(`students/${id}`), { name, familyId, active: true, createdAt: now, updatedAt: now });
  }

  // Menú de la semana actual y la siguiente (el miércoles de la siguiente, sin servicio).
  const monday = DateTime.now().setZone(ZONE).startOf('week');
  for (const weekStart of [monday, monday.plus({ weeks: 1 })]) {
    const weekId = weekStart.toISODate();
    batch.set(db.doc(`menuWeeks/${weekId}`), { weekStart: weekId, hasImage: false, imageUpdatedAt: null, updatedAt: now });
    for (let i = 0; i < 5; i++) {
      const date = weekStart.plus({ days: i }).toISODate();
      const noService = weekStart > monday && i === 2;
      batch.set(db.doc(`menuDays/${date}`), {
        date,
        weekId,
        noService,
        breakfast: { available: true, description: MENUS[i][0], cutoffAt: cutoff(date, 10) },
        lunch: { available: i !== 4, description: i === 4 ? '' : MENUS[i][1], cutoffAt: cutoff(date, 11) },
        updatedAt: now,
      });
    }
  }

  // Algunos pedidos de ejemplo.
  const today = DateTime.now().setZone(ZONE).toISODate();
  const tomorrow = DateTime.now().setZone(ZONE).plus({ days: 1 }).toISODate();
  const order = (date, studentId, studentName, familyId, service, price, extra = {}) => {
    batch.set(db.doc(`orders/${date}_${studentId}_${service}`), {
      date,
      studentId,
      studentName,
      familyId,
      service,
      priceAtOrder: price,
      status: 'active',
      paymentStatus: 'pending',
      source: 'parent',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'seed',
      updatedBy: 'seed',
      ...extra,
    });
  };
  order(today, 'demo-mateo', 'Mateo Demo', 'demo-fam-1', 'lunch', 70);
  order(today, 'demo-lucia', 'Lucía Demo', 'demo-fam-2', 'breakfast', 55, { paymentStatus: 'paid' });
  order(today, 'demo-lucia', 'Lucía Demo', 'demo-fam-2', 'lunch', 70);
  order(tomorrow, 'demo-sofia', 'Sofía Demo', 'demo-fam-1', 'breakfast', 55);

  await batch.commit();
  console.log('Datos DEMO cargados en el emulador. Contraseña de todas las cuentas: demo1234');
  for (const u of USERS) console.log(`  ${u.email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
