/**
 * Pruebas de las reglas de seguridad contra Firebase Emulator Suite.
 * Ejecutar con: npm run test:rules
 *
 * El emulador evalúa request.time con SU reloj; el cliente no puede influir en él.
 * Por eso los cierres se simulan guardando cutoffAt en el pasado o en el futuro.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-ijlv-rules';

let env: RulesTestEnvironment;

// ---------------------------------------------------------------- fixtures
const ADMIN = { uid: 'admin-uid', email: 'admin@demo.test' };
const PARENT_A = { uid: 'parent-a', email: 'papa.a@demo.test' };
const PARENT_A2 = { uid: 'parent-a2', email: 'mama.a@demo.test' }; // segundo correo de la familia A
const PARENT_B = { uid: 'parent-b', email: 'papa.b@demo.test' };
const STRANGER = { uid: 'stranger', email: 'desconocido@demo.test' };

const FUTURE = () => Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
const PAST = () => Timestamp.fromMillis(Date.now() - 1000);

const OPEN_DAY = '2031-03-03';
const CLOSED_DAY = '2031-03-04';
const NO_SERVICE_DAY = '2031-03-05';
const NO_BREAKFAST_DAY = '2031-03-06';
const FUTURE_DAY = '2031-03-10';

type Provider = 'password' | 'google.com';

/** Contexto autenticado con el token que emitiría Firebase Auth para ese proveedor. */
function dbFor(user: { uid: string; email: string }, emailVerified = true, provider: Provider = 'password'): Firestore {
  return env
    .authenticatedContext(user.uid, {
      email: user.email,
      email_verified: emailVerified,
      firebase: { sign_in_provider: provider, identities: {} },
    })
    .firestore() as unknown as Firestore;
}

function menuDay(date: string, opts: { noService?: boolean; breakfast?: boolean; lunch?: boolean; cutoff: Timestamp }) {
  return {
    date,
    weekId: '2031-03-03',
    noService: opts.noService ?? false,
    breakfast: { available: opts.breakfast ?? true, description: 'Molletes DEMO', cutoffAt: opts.cutoff },
    lunch: { available: opts.lunch ?? true, description: 'Arroz y pollo DEMO', cutoffAt: opts.cutoff },
    updatedAt: Timestamp.now(),
  };
}

function orderId(date: string, studentId: string, service: 'breakfast' | 'lunch') {
  return `${date}_${studentId}_${service}`;
}

function parentOrder(
  user: { uid: string },
  date: string,
  studentId: string,
  studentName: string,
  familyId: string,
  service: 'breakfast' | 'lunch',
  price: number,
) {
  return {
    date,
    studentId,
    studentName,
    familyId,
    service,
    priceAtOrder: price,
    status: 'active',
    paymentStatus: 'pending',
    source: 'parent',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
    updatedBy: user.uid,
  };
}

const mateoBreakfast = (date = OPEN_DAY) =>
  parentOrder(PARENT_A, date, 'mateo', 'Mateo Demo', 'fam-a', 'breakfast', 55);

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const now = Timestamp.now();
    await setDoc(doc(db, 'admins', ADMIN.email), { createdAt: now });
    await setDoc(doc(db, 'families', 'fam-a'), { name: 'Familia Demo 1', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'families', 'fam-b'), { name: 'Familia Demo 2', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'authorizedEmails', PARENT_A.email), { familyId: 'fam-a', createdAt: now });
    await setDoc(doc(db, 'authorizedEmails', PARENT_A2.email), { familyId: 'fam-a', createdAt: now });
    await setDoc(doc(db, 'authorizedEmails', PARENT_B.email), { familyId: 'fam-b', createdAt: now });
    await setDoc(doc(db, 'students', 'mateo'), { name: 'Mateo Demo', familyId: 'fam-a', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'students', 'sofia'), { name: 'Sofía Demo', familyId: 'fam-a', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'students', 'inactivo'), { name: 'Baja Demo', familyId: 'fam-a', active: false, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'students', 'lucia'), { name: 'Lucía Demo', familyId: 'fam-b', active: true, createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'settings', 'app'), { prices: { breakfast: 55, lunch: 70 }, updatedAt: now });
    await setDoc(doc(db, 'menuDays', OPEN_DAY), menuDay(OPEN_DAY, { cutoff: FUTURE() }));
    await setDoc(doc(db, 'menuDays', CLOSED_DAY), menuDay(CLOSED_DAY, { cutoff: PAST() }));
    await setDoc(doc(db, 'menuDays', NO_SERVICE_DAY), menuDay(NO_SERVICE_DAY, { noService: true, cutoff: FUTURE() }));
    await setDoc(doc(db, 'menuDays', NO_BREAKFAST_DAY), menuDay(NO_BREAKFAST_DAY, { breakfast: false, cutoff: FUTURE() }));
    await setDoc(doc(db, 'menuDays', FUTURE_DAY), menuDay(FUTURE_DAY, { cutoff: Timestamp.fromMillis(Date.now() + 7 * 86400000) }));
    // Pedido de la familia B y pedido de A en día ya cerrado.
    await setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'lunch')), {
      ...parentOrder(PARENT_B, OPEN_DAY, 'lucia', 'Lucía Demo', 'fam-b', 'lunch', 70),
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'lunch')), {
      ...parentOrder(PARENT_A, CLOSED_DAY, 'mateo', 'Mateo Demo', 'fam-a', 'lunch', 70),
      createdAt: now,
      updatedAt: now,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

afterAll(async () => {
  await env?.cleanup();
});

// ======================================================================
describe('AUTORIZACIÓN', () => {
  it('1. Padre A ve a sus hijos pero no los de Padre B', async () => {
    const db = dbFor(PARENT_A);
    await assertSucceeds(getDoc(doc(db, 'students', 'mateo')));
    await assertSucceeds(getDocs(query(collection(db, 'students'), where('familyId', '==', 'fam-a'))));
    await assertFails(getDoc(doc(db, 'students', 'lucia')));
    await assertFails(getDocs(query(collection(db, 'students'), where('familyId', '==', 'fam-b'))));
    await assertFails(getDocs(collection(db, 'students')));
    await assertFails(getDoc(doc(db, 'families', 'fam-b')));
    await assertFails(getDoc(doc(db, 'authorizedEmails', PARENT_B.email)));
  });

  it('1b. Padre A no ve pedidos de otra familia', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(getDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'lunch'))));
    await assertFails(getDocs(query(collection(db, 'orders'), where('familyId', '==', 'fam-b'))));
    await assertFails(getDocs(collection(db, 'orders')));
    await assertSucceeds(getDocs(query(collection(db, 'orders'), where('familyId', '==', 'fam-a'))));
    // Consultar un pedido inexistente: permitido solo para alumnos propios.
    await assertSucceeds(getDoc(doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast'))));
    await assertFails(getDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'breakfast'))));
  });

  it('2. Padre A no puede pedir para alumno de Padre B', async () => {
    const db = dbFor(PARENT_A);
    const forged = parentOrder(PARENT_A, OPEN_DAY, 'lucia', 'Lucía Demo', 'fam-b', 'breakfast', 55);
    await assertFails(setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'breakfast')), forged));
    const forgedFamily = parentOrder(PARENT_A, OPEN_DAY, 'lucia', 'Lucía Demo', 'fam-a', 'breakfast', 55);
    await assertFails(setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'breakfast')), forgedFamily));
  });

  it('3. Padre no puede convertirse en administrador', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(setDoc(doc(db, 'admins', PARENT_A.email), { createdAt: serverTimestamp() }));
    await assertFails(getDocs(collection(db, 'admins')));
    // Ni siquiera un administrador puede crear administradores desde el cliente.
    await assertFails(setDoc(doc(dbFor(ADMIN), 'admins', PARENT_A.email), { createdAt: serverTimestamp() }));
  });

  it('3b. Padre no puede cambiar datos administrativos ni vincularse a otra familia', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(setDoc(doc(db, 'authorizedEmails', PARENT_A.email), { familyId: 'fam-b', createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'families', 'fam-a'), { name: 'Hack', updatedAt: serverTimestamp() }));
    await assertFails(
      setDoc(doc(db, 'students', 'nuevo'), {
        name: 'Nuevo',
        familyId: 'fam-a',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(db, 'menuDays', OPEN_DAY), { noService: true, updatedAt: serverTimestamp() }));
  });

  it('4. Padre no puede cambiar precios', async () => {
    const db = dbFor(PARENT_A);
    await assertSucceeds(getDoc(doc(db, 'settings', 'app')));
    await assertFails(setDoc(doc(db, 'settings', 'app'), { prices: { breakfast: 1, lunch: 1 }, updatedAt: serverTimestamp() }));
  });

  it('4b. Padre no puede manipular priceAtOrder', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')), { ...mateoBreakfast(), priceAtOrder: 1 }));
  });

  it('5. Padre no puede marcar como pagado', async () => {
    const db = dbFor(PARENT_A);
    const id = orderId(OPEN_DAY, 'mateo', 'breakfast');
    await assertFails(setDoc(doc(db, 'orders', id), { ...mateoBreakfast(), paymentStatus: 'paid' }));
    await assertSucceeds(setDoc(doc(db, 'orders', id), mateoBreakfast()));
    await assertFails(updateDoc(doc(db, 'orders', id), { paymentStatus: 'paid', updatedAt: serverTimestamp(), updatedBy: PARENT_A.uid }));
  });

  it('correo sin verificar o no autorizado no ve nada', async () => {
    const unverified = dbFor(PARENT_A, false);
    await assertFails(getDoc(doc(unverified, 'students', 'mateo')));
    await assertFails(getDoc(doc(unverified, 'settings', 'app')));
    const stranger = dbFor(STRANGER);
    await assertSucceeds(getDoc(doc(stranger, 'authorizedEmails', STRANGER.email))); // su propio doc (no existe)
    await assertFails(getDoc(doc(stranger, 'menuDays', OPEN_DAY)));
    await assertFails(getDoc(doc(stranger, 'settings', 'app')));
    await assertFails(getDocs(query(collection(stranger, 'students'), where('familyId', '==', 'fam-a'))));
    const anon = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(getDoc(doc(anon, 'menuDays', OPEN_DAY)));
  });

  it('el correo del token se compara sin distinguir mayúsculas', async () => {
    const db = dbFor({ uid: PARENT_A.uid, email: 'Papa.A@Demo.test' });
    await assertSucceeds(getDoc(doc(db, 'students', 'mateo')));
  });
});

// ======================================================================
describe('HORARIOS (hora del servidor)', () => {
  it('servicio abierto → padre puede pedir', async () => {
    await assertSucceeds(setDoc(doc(dbFor(PARENT_A), 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')), mateoBreakfast()));
  });

  it('servicio cerrado → padre NO puede pedir desayuno ni comida', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(setDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'breakfast')), mateoBreakfast(CLOSED_DAY)));
    await assertFails(
      setDoc(
        doc(db, 'orders', orderId(CLOSED_DAY, 'sofia', 'lunch')),
        parentOrder(PARENT_A, CLOSED_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'lunch', 70),
      ),
    );
  });

  it('10. manipular el reloj local no evita el cierre', async () => {
    const db = dbFor(PARENT_A);
    // Un cliente con el reloj atrasado envía una hora anterior al cierre: se rechaza.
    const spoofed = { ...mateoBreakfast(CLOSED_DAY), createdAt: Timestamp.fromMillis(0), updatedAt: Timestamp.fromMillis(0) };
    await assertFails(setDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'breakfast')), spoofed));
    // Aun con serverTimestamp (hora real del servidor) el día cerrado sigue cerrado.
    await assertFails(setDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'breakfast')), mateoBreakfast(CLOSED_DAY)));
  });

  it('pedido sin menú publicado para esa fecha → rechazado', async () => {
    await assertFails(setDoc(doc(dbFor(PARENT_A), 'orders', orderId('2031-05-05', 'mateo', 'breakfast')), mateoBreakfast('2031-05-05')));
  });
});

// ======================================================================
describe('ADMINISTRACIÓN', () => {
  function adminOrder(date: string, studentId: string, name: string, familyId: string, service: 'breakfast' | 'lunch', price: number) {
    return { ...parentOrder(ADMIN, date, studentId, name, familyId, service, price), source: 'admin' };
  }

  it('11. Admin puede registrar desayuno después del cierre', async () => {
    const db = dbFor(ADMIN);
    await assertSucceeds(
      setDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'sofia', 'breakfast')), adminOrder(CLOSED_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'breakfast', 55)),
    );
  });

  it('12. Admin puede registrar comida después del cierre', async () => {
    const db = dbFor(ADMIN);
    await assertSucceeds(
      setDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'sofia', 'lunch')), adminOrder(CLOSED_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'lunch', 70)),
    );
  });

  it('admin cambia estado de pago, precios, menú y familias', async () => {
    const db = dbFor(ADMIN);
    const id = orderId(CLOSED_DAY, 'mateo', 'lunch');
    await assertSucceeds(updateDoc(doc(db, 'orders', id), { paymentStatus: 'paid', updatedAt: serverTimestamp(), updatedBy: ADMIN.uid }));
    await assertSucceeds(setDoc(doc(db, 'settings', 'app'), { prices: { breakfast: 60, lunch: 75 }, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'menuDays', '2031-03-07'), { ...menuDay('2031-03-07', { cutoff: FUTURE() }), updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'families', 'fam-c'), { name: 'Familia Demo 3', active: true, createdAt: Timestamp.now(), updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'authorizedEmails', 'nuevo@demo.test'), { familyId: 'fam-c', createdAt: Timestamp.now() }));
    await assertSucceeds(getDocs(collection(db, 'orders')));
    await assertSucceeds(getDocs(collection(db, 'students')));
  });

  it('admin no puede usar IDs arbitrarios ni cambiar alumno/fecha de un pedido', async () => {
    const db = dbFor(ADMIN);
    await assertFails(setDoc(doc(db, 'orders', 'random-id'), adminOrder(CLOSED_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'lunch', 70)));
    await assertFails(updateDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'lunch')), { date: OPEN_DAY, updatedAt: serverTimestamp(), updatedBy: ADMIN.uid }));
  });

  it('nadie puede borrar pedidos (se cancelan)', async () => {
    await assertFails(deleteDoc(doc(dbFor(ADMIN), 'orders', orderId(CLOSED_DAY, 'mateo', 'lunch'))));
  });

  it('correo de admin sin verificar no es admin', async () => {
    await assertFails(getDocs(collection(dbFor(ADMIN, false), 'orders')));
  });
});

// ======================================================================
describe('DUPLICADOS', () => {
  it('13. Dos intentos de desayuno para el mismo alumno/día no producen dos pedidos', async () => {
    const db = dbFor(PARENT_A);
    const id = orderId(OPEN_DAY, 'mateo', 'breakfast');
    await assertSucceeds(setDoc(doc(db, 'orders', id), mateoBreakfast()));
    await assertFails(setDoc(doc(db, 'orders', id), mateoBreakfast())); // ya existe: sería update active→active
    await assertFails(setDoc(doc(db, 'orders', `${id}_2`), mateoBreakfast())); // ID no determinista
    await assertFails(setDoc(doc(collection(db, 'orders')), mateoBreakfast())); // ID aleatorio
  });

  it('14. Dos intentos simultáneos de comida (dos tutores) dejan UN solo pedido', async () => {
    const id = orderId(OPEN_DAY, 'sofia', 'lunch');
    const attempt = (user: { uid: string; email: string }) => {
      const db = dbFor(user);
      return runTransaction(db, async (tx) => {
        const ref = doc(db, 'orders', id);
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error('duplicado');
        tx.set(ref, parentOrder(user, OPEN_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'lunch', 70));
      });
    };
    const results = await Promise.allSettled([attempt(PARENT_A), attempt(PARENT_A2)]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      const snap = await getDocs(query(collection(db, 'orders'), where('studentId', '==', 'sofia'), where('service', '==', 'lunch')));
      expect(snap.size).toBe(1);
      expect(snap.docs[0].data().status).toBe('active');
    });
  });
});

// ======================================================================
describe('PEDIDOS FUTUROS, CANCELACIÓN Y DÍAS SIN SERVICIO', () => {
  it('15. Padre puede pedir un servicio futuro disponible', async () => {
    const db = dbFor(PARENT_A);
    await assertSucceeds(
      setDoc(
        doc(db, 'orders', orderId(FUTURE_DAY, 'sofia', 'lunch')),
        parentOrder(PARENT_A, FUTURE_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'lunch', 70),
      ),
    );
  });

  it('16. Padre cancela antes del cierre y puede volver a solicitar', async () => {
    const db = dbFor(PARENT_A);
    const id = orderId(OPEN_DAY, 'mateo', 'breakfast');
    await assertSucceeds(setDoc(doc(db, 'orders', id), mateoBreakfast()));
    await assertSucceeds(updateDoc(doc(db, 'orders', id), { status: 'cancelled', updatedAt: serverTimestamp(), updatedBy: PARENT_A.uid }));
    await assertSucceeds(
      updateDoc(doc(db, 'orders', id), { status: 'active', priceAtOrder: 55, updatedAt: serverTimestamp(), updatedBy: PARENT_A.uid }),
    );
  });

  it('17. Padre NO puede cancelar después del cierre', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(
      updateDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'lunch')), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
        updatedBy: PARENT_A.uid,
      }),
    );
  });

  it('18. Admin sí puede cancelar después del cierre', async () => {
    await assertSucceeds(
      updateDoc(doc(dbFor(ADMIN), 'orders', orderId(CLOSED_DAY, 'mateo', 'lunch')), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN.uid,
      }),
    );
  });

  it('Padre B no puede cancelar pedidos de la familia A', async () => {
    const dbA = dbFor(PARENT_A);
    const id = orderId(OPEN_DAY, 'mateo', 'breakfast');
    await assertSucceeds(setDoc(doc(dbA, 'orders', id), mateoBreakfast()));
    await assertFails(updateDoc(doc(dbFor(PARENT_B), 'orders', id), { status: 'cancelled', updatedAt: serverTimestamp(), updatedBy: PARENT_B.uid }));
  });

  it('19. Día sin servicio: padre no puede solicitar alimentos', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(setDoc(doc(db, 'orders', orderId(NO_SERVICE_DAY, 'mateo', 'breakfast')), mateoBreakfast(NO_SERVICE_DAY)));
    await assertFails(
      setDoc(
        doc(db, 'orders', orderId(NO_SERVICE_DAY, 'mateo', 'lunch')),
        parentOrder(PARENT_A, NO_SERVICE_DAY, 'mateo', 'Mateo Demo', 'fam-a', 'lunch', 70),
      ),
    );
  });

  it('19b. Servicio no disponible ese día: no se puede pedir', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(setDoc(doc(db, 'orders', orderId(NO_BREAKFAST_DAY, 'mateo', 'breakfast')), mateoBreakfast(NO_BREAKFAST_DAY)));
    await assertSucceeds(
      setDoc(
        doc(db, 'orders', orderId(NO_BREAKFAST_DAY, 'mateo', 'lunch')),
        parentOrder(PARENT_A, NO_BREAKFAST_DAY, 'mateo', 'Mateo Demo', 'fam-a', 'lunch', 70),
      ),
    );
  });

  it('alumno dado de baja no puede recibir pedidos de padres', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(
      setDoc(
        doc(db, 'orders', orderId(OPEN_DAY, 'inactivo', 'lunch')),
        parentOrder(PARENT_A, OPEN_DAY, 'inactivo', 'Baja Demo', 'fam-a', 'lunch', 70),
      ),
    );
  });
});

// ======================================================================
describe('PRECIOS Y MULTIHIJO', () => {
  it('21. Un cambio posterior de precio no modifica pedidos históricos', async () => {
    const parent = dbFor(PARENT_A);
    const id = orderId(OPEN_DAY, 'mateo', 'breakfast');
    await assertSucceeds(setDoc(doc(parent, 'orders', id), mateoBreakfast()));
    await assertSucceeds(setDoc(doc(dbFor(ADMIN), 'settings', 'app'), { prices: { breakfast: 60, lunch: 80 }, updatedAt: serverTimestamp() }));

    const snap = await getDoc(doc(parent, 'orders', id));
    expect(snap.data()?.priceAtOrder).toBe(55);

    // Los pedidos nuevos deben usar el precio vigente.
    const sofia = (price: number) => parentOrder(PARENT_A, OPEN_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'breakfast', price);
    await assertFails(setDoc(doc(parent, 'orders', orderId(OPEN_DAY, 'sofia', 'breakfast')), sofia(55)));
    await assertSucceeds(setDoc(doc(parent, 'orders', orderId(OPEN_DAY, 'sofia', 'breakfast')), sofia(60)));
  });

  it('22. Un padre con dos hijos solicita para ambos en una sola operación', async () => {
    const db = dbFor(PARENT_A);
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'lunch')), parentOrder(PARENT_A, OPEN_DAY, 'mateo', 'Mateo Demo', 'fam-a', 'lunch', 70));
    batch.set(doc(db, 'orders', orderId(OPEN_DAY, 'sofia', 'lunch')), parentOrder(PARENT_A, OPEN_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'lunch', 70));
    await assertSucceeds(batch.commit());
    const mine = await getDocs(query(collection(db, 'orders'), where('familyId', '==', 'fam-a'), where('date', '==', OPEN_DAY)));
    expect(mine.size).toBe(2);
  });
});

// ======================================================================
describe('IMAGEN DEL MENÚ', () => {
  it('solo admin sube la imagen y con tamaño acotado', async () => {
    const asset = (size: number) => ({
      dataUrl: 'data:image/webp;base64,' + 'A'.repeat(size),
      mimeType: 'image/webp',
      width: 1200,
      height: 1600,
      bytes: size,
      updatedAt: serverTimestamp(),
    });
    await assertFails(setDoc(doc(dbFor(PARENT_A), 'menuAssets', '2031-03-03'), asset(1000)));
    await assertSucceeds(setDoc(doc(dbFor(ADMIN), 'menuAssets', '2031-03-03'), asset(1000)));
    await assertFails(setDoc(doc(dbFor(ADMIN), 'menuAssets', '2031-03-10'), asset(720000)));
    await assertSucceeds(getDoc(doc(dbFor(PARENT_A), 'menuAssets', '2031-03-03')));
  });
});

// ======================================================================
// ENDURECIMIENTO: autenticarse NO equivale a estar autorizado
// ======================================================================
function familyDataAccess(db: Firestore) {
  return {
    family: () => getDoc(doc(db, 'families', 'fam-a')),
    students: () => getDocs(query(collection(db, 'students'), where('familyId', '==', 'fam-a'))),
    student: () => getDoc(doc(db, 'students', 'mateo')),
    orders: () => getDocs(query(collection(db, 'orders'), where('familyId', '==', 'fam-a'))),
    order: () => getDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'lunch'))),
    access: () => getDoc(doc(db, 'authorizedEmails', PARENT_A.email)),
    menu: () => getDoc(doc(db, 'menuDays', OPEN_DAY)),
    settings: () => getDoc(doc(db, 'settings', 'app')),
  };
}

describe('A. correo y contraseña SIN verificar (el correo sí es de una familia)', () => {
  it('1-4. no lee familia, alumnos, pedidos ni pagos, ni puede pedir', async () => {
    const db = dbFor(PARENT_A, false, 'password');
    const r = familyDataAccess(db);
    await assertFails(r.family());
    await assertFails(r.students());
    await assertFails(r.student());
    await assertFails(r.orders()); // incluye estados de pago
    await assertFails(r.order());
    await assertFails(r.access()); // ni siquiera ve a qué familia está asociado su correo
    await assertFails(r.menu());
    await assertFails(r.settings());
    await assertFails(setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')), mateoBreakfast()));
    await assertFails(
      updateDoc(doc(db, 'orders', orderId(CLOSED_DAY, 'mateo', 'lunch')), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
        updatedBy: PARENT_A.uid,
      }),
    );
  });
});

describe('B. correo y contraseña VERIFICADO y autorizado', () => {
  it('5-7. accede únicamente a su familia y sus hijos', async () => {
    const db = dbFor(PARENT_A, true, 'password');
    const r = familyDataAccess(db);
    await assertSucceeds(r.family());
    await assertSucceeds(r.students());
    await assertSucceeds(r.student());
    await assertSucceeds(r.orders());
    await assertSucceeds(r.order());
    await assertSucceeds(r.access());
    await assertSucceeds(r.menu());
    await assertFails(getDoc(doc(db, 'families', 'fam-b')));
    await assertFails(getDoc(doc(db, 'students', 'lucia')));
    await assertSucceeds(setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')), mateoBreakfast()));
  });
});

describe('C. correo verificado pero NO registrado por el IJLV', () => {
  it('8-11. no obtiene ningún dato familiar ni puede pedir', async () => {
    const db = dbFor(STRANGER, true, 'password');
    const r = familyDataAccess(db);
    for (const p of [r.family, r.students, r.student, r.orders, r.order, r.access, r.menu, r.settings]) await assertFails(p());
    await assertFails(
      setDoc(
        doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')),
        { ...mateoBreakfast(), createdBy: STRANGER.uid, updatedBy: STRANGER.uid },
      ),
    );
    // No puede enumerar la tabla correo → familia ni las familias.
    await assertFails(getDocs(collection(db, 'authorizedEmails')));
    await assertFails(getDocs(collection(db, 'families')));
  });
});

describe('D. intento de suplantación', () => {
  it('12-13. un tercero crea una cuenta SIN verificar con el correo de una familia: sin acceso', async () => {
    const attacker = { uid: 'attacker-uid', email: PARENT_A.email };
    const db = dbFor(attacker, false, 'password');
    const r = familyDataAccess(db);
    for (const p of [r.family, r.students, r.student, r.orders, r.order, r.access, r.menu, r.settings]) await assertFails(p());
    await assertFails(
      setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')), {
        ...mateoBreakfast(),
        createdBy: attacker.uid,
        updatedBy: attacker.uid,
      }),
    );
  });

  it('13b. tampoco sirve con mayúsculas distintas ni con el correo de un administrador', async () => {
    await assertFails(getDoc(doc(dbFor({ uid: 'x', email: 'PAPA.A@DEMO.TEST' }, false), 'students', 'mateo')));
    const fakeAdmin = dbFor({ uid: 'x2', email: ADMIN.email }, false);
    await assertFails(getDocs(collection(fakeAdmin, 'orders')));
    await assertFails(getDocs(collection(fakeAdmin, 'families')));
    await assertFails(setDoc(doc(fakeAdmin, 'settings', 'app'), { prices: { breakfast: 1, lunch: 1 }, updatedAt: serverTimestamp() }));
  });
});

describe('E y F. otra familia / otro alumno', () => {
  it('14-15. Padre A no puede consultar la familia B', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(getDoc(doc(db, 'families', 'fam-b')));
    await assertFails(getDocs(query(collection(db, 'orders'), where('familyId', '==', 'fam-b'))));
    await assertFails(getDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'lunch'))));
  });

  it('16-17. Padre A no puede usar el studentId de un alumno de la familia B', async () => {
    const db = dbFor(PARENT_A);
    await assertFails(getDoc(doc(db, 'students', 'lucia')));
    // Ni declarando su propia familia, ni la familia B.
    for (const familyId of ['fam-a', 'fam-b']) {
      await assertFails(
        setDoc(
          doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'breakfast')),
          parentOrder(PARENT_A, OPEN_DAY, 'lucia', 'Lucía Demo', familyId, 'breakfast', 55),
        ),
      );
    }
    // Ni cancelar el pedido existente de ese alumno.
    await assertFails(
      updateDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'lunch')), { status: 'cancelled', updatedAt: serverTimestamp(), updatedBy: PARENT_A.uid }),
    );
    // Ni sondear si existe un pedido de ese alumno.
    await assertFails(getDoc(doc(db, 'orders', orderId(OPEN_DAY, 'lucia', 'breakfast'))));
  });
});

describe('G. Google usa la MISMA autorización', () => {
  it('18. Google con correo autorizado: acceso a su familia', async () => {
    const db = dbFor(PARENT_A, true, 'google.com');
    const r = familyDataAccess(db);
    await assertSucceeds(r.family());
    await assertSucceeds(r.students());
    await assertSucceeds(r.orders());
    await assertSucceeds(setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'sofia', 'breakfast')), {
      ...parentOrder(PARENT_A, OPEN_DAY, 'sofia', 'Sofía Demo', 'fam-a', 'breakfast', 55),
    }));
    await assertFails(getDoc(doc(db, 'students', 'lucia')));
  });

  it('19. Google con correo no autorizado: sin acceso familiar', async () => {
    const db = dbFor(STRANGER, true, 'google.com');
    const r = familyDataAccess(db);
    for (const p of [r.family, r.students, r.student, r.orders, r.order, r.access, r.menu, r.settings]) await assertFails(p());
  });

  it('19b. Google con correo no verificado por Google: sin acceso', async () => {
    const r = familyDataAccess(dbFor(PARENT_A, false, 'google.com'));
    for (const p of [r.family, r.students, r.orders, r.menu]) await assertFails(p());
  });
});

describe('H. cambio de correo', () => {
  it('20. la misma cuenta con un correo nuevo (no autorizado) pierde el acceso a su familia anterior', async () => {
    const db = dbFor({ uid: PARENT_A.uid, email: 'nuevo.correo@demo.test' }, true);
    const r = familyDataAccess(db);
    for (const p of [r.family, r.students, r.student, r.orders, r.order, r.menu]) await assertFails(p());
    await assertFails(setDoc(doc(db, 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')), mateoBreakfast()));
  });

  it('20b. cambiar al correo de otra familia sin haberlo verificado no da acceso a esa familia', async () => {
    const db = dbFor({ uid: PARENT_A.uid, email: PARENT_B.email }, false);
    await assertFails(getDoc(doc(db, 'families', 'fam-b')));
    await assertFails(getDoc(doc(db, 'students', 'lucia')));
    await assertFails(getDoc(doc(db, 'families', 'fam-a')));
  });

  it('20c. si el IJLV retira el correo autorizado, el acceso termina en la siguiente petición', async () => {
    const db = dbFor(PARENT_A);
    await assertSucceeds(getDoc(doc(db, 'students', 'mateo')));
    await assertSucceeds(deleteDoc(doc(dbFor(ADMIN), 'authorizedEmails', PARENT_A.email)));
    await assertFails(getDoc(doc(db, 'students', 'mateo')));
    await assertFails(getDocs(query(collection(db, 'orders'), where('familyId', '==', 'fam-a'))));
  });
});

describe('Familia inactiva', () => {
  it('una familia desactivada por el IJLV pierde el acceso a sus datos', async () => {
    await assertSucceeds(updateDoc(doc(dbFor(ADMIN), 'families', 'fam-a'), { active: false, updatedAt: serverTimestamp() }));
    const r = familyDataAccess(dbFor(PARENT_A));
    for (const p of [r.family, r.students, r.student, r.orders, r.order, r.menu, r.settings]) await assertFails(p());
    await assertFails(setDoc(doc(dbFor(PARENT_A), 'orders', orderId(OPEN_DAY, 'mateo', 'breakfast')), mateoBreakfast()));
    // Su propio documento de autorización sí lo puede leer (así la app sabe mostrar "sin acceso").
    await assertSucceeds(r.access());
  });
});

describe('Administradores', () => {
  it('nadie puede crearse admin: ni por cliente, ni cambiando correo sin verificar, ni escribiendo authorizedEmails', async () => {
    for (const db of [dbFor(PARENT_A), dbFor(STRANGER), dbFor({ uid: PARENT_A.uid, email: ADMIN.email }, false)]) {
      await assertFails(setDoc(doc(db, 'admins', PARENT_A.email), { createdAt: serverTimestamp() }));
      await assertFails(setDoc(doc(db, 'admins', STRANGER.email), { createdAt: serverTimestamp() }));
      await assertFails(getDocs(collection(db, 'admins')));
      await assertFails(setDoc(doc(db, 'authorizedEmails', STRANGER.email), { familyId: 'fam-a', createdAt: serverTimestamp() }));
    }
    // Un admin real tampoco puede editar la colección admins desde el cliente.
    await assertFails(deleteDoc(doc(dbFor(ADMIN), 'admins', ADMIN.email)));
  });
});
