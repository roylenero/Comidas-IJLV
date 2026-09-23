import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/app';
import { normalizeEmail } from '../firebase/paths';
import { AppError } from '../lib/errors';

/**
 * Dos formas de entrar: Google y correo + contraseña. Ambas solo prueban QUIÉN entra.
 * Qué familia e hijos ve lo decide la MISMA capa de autorización (services/access.ts y
 * firestore.rules), que exige correo verificado y previamente autorizado por el IJLV.
 */

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function actionSettings() {
  return { url: `${window.location.origin}/`, handleCodeInApp: false };
}

function validEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!EMAIL_RE.test(email)) throw new AppError('validation', 'Escribe un correo válido.');
  return email;
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string }).code;
    // Algunos navegadores (o la app instalada en iPhone) bloquean ventanas emergentes.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, validEmail(email), password);
}

/**
 * Primera vez: crea la contraseña y envía el correo de verificación.
 * Hasta que el correo se verifique, las reglas no dan acceso a ningún dato familiar.
 */
export async function createPasswordAccount(email: string, password: string): Promise<void> {
  const normalized = validEmail(email);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError('validation', `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  const cred = await createUserWithEmailAndPassword(auth, normalized, password);
  await sendEmailVerification(cred.user, actionSettings());
}

export async function resendVerification(user: User): Promise<void> {
  await sendEmailVerification(user, actionSettings());
}

/**
 * Envía el correo para crear una contraseña nueva. La respuesta es la misma exista o no
 * la cuenta, para no revelar qué correos están registrados.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const normalized = validEmail(email);
  try {
    await sendPasswordResetEmail(auth, normalized, actionSettings());
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') return;
    throw err;
  }
}

/**
 * Vuelve a consultar el estado real del usuario y, si ya verificó, obtiene un token
 * nuevo para que las reglas vean email_verified = true.
 */
export async function refreshVerification(user: User): Promise<boolean> {
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}
