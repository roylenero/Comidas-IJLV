import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

// storageBucket se omite a propósito: la app no usa Firebase Storage (la imagen del menú vive en Firestore).
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-api-key' : ''),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (useEmulators ? 'localhost' : ''),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? 'demo-ijlv' : ''),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

export const app = initializeApp(config);

// La sesión persiste en el dispositivo: el padre inicia sesión una vez y no vuelve a hacerlo.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
auth.languageCode = 'es';

// Caché SOLO en memoria: sin persistencia offline de Firestore. Así ninguna escritura
// queda "pendiente" en el dispositivo aparentando haberse guardado.
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
