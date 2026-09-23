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

function actionSettings() {
  return { url: `${window.location.origin}/`, handleCodeInApp: false };
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
  await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
}

/** Primera vez: crea la contraseña y envía el correo de verificación. */
export async function createPasswordAccount(email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
  await sendEmailVerification(cred.user, actionSettings());
}

export async function resendVerification(user: User): Promise<void> {
  await sendEmailVerification(user, actionSettings());
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, normalizeEmail(email), actionSettings());
}

/** Recarga el usuario y fuerza un token nuevo para que las reglas vean email_verified=true. */
export async function refreshVerification(user: User): Promise<boolean> {
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}
