export type AppErrorKind = 'offline' | 'timeout' | 'permission' | 'closed' | 'duplicate' | 'validation' | 'unknown';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  constructor(kind: AppErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'AppError';
  }
}

export const OFFLINE_MESSAGE =
  'No hay conexión a internet. Tu pedido NO se ha enviado. Revisa tu conexión e inténtalo de nuevo.';

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'El correo no tiene un formato válido.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/email-already-in-use':
    'Este correo ya tiene una contraseña. Entra con ella o usa "Olvidé mi contraseña" para crear una nueva.',
  'auth/weak-password': 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'No hay conexión a internet. Revisa tu conexión e inténtalo de nuevo.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar. Inténtalo de nuevo.',
  'auth/cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar. Inténtalo de nuevo.',
  'auth/expired-action-code': 'El enlace ya expiró. Solicita uno nuevo.',
  'auth/invalid-action-code': 'El enlace no es válido o ya se usó. Solicita uno nuevo.',
  'auth/quota-exceeded': 'Se alcanzó el límite diario de correos. Inténtalo más tarde o comunícate con el Instituto.',
  'auth/operation-not-allowed': 'Este método de acceso no está habilitado. Comunícate con el Instituto.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión. Comunícate con el Instituto.',
  'auth/account-exists-with-different-credential':
    'Este correo ya entra con otro método. Prueba "Continuar con Google" o "Olvidé mi contraseña".',
  'auth/user-disabled': 'Esta cuenta está desactivada. Comunícate con el Instituto.',
};

function codeOf(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return undefined;
}

export function isOfflineError(err: unknown): boolean {
  if (err instanceof AppError) return err.kind === 'offline' || err.kind === 'timeout';
  const code = codeOf(err);
  return code === 'unavailable' || code === 'deadline-exceeded' || code === 'auth/network-request-failed';
}

/** Mensaje comprensible en español para cualquier error de la app o de Firebase. */
export function describeError(err: unknown): string {
  if (err instanceof AppError) return err.message;
  const code = codeOf(err);
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  switch (code) {
    case 'permission-denied':
      return 'No fue posible guardar: la operación no está permitida (puede que el horario ya haya cerrado). Actualiza la pantalla e inténtalo de nuevo.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'No hay conexión con el servidor. Nada se ha guardado. Revisa tu conexión e inténtalo de nuevo.';
    case 'failed-precondition':
    case 'aborted':
      return 'Otra persona modificó esta información al mismo tiempo. Inténtalo de nuevo.';
    case 'not-found':
      return 'No se encontró la información solicitada.';
    default:
      return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
}

/**
 * Espera la confirmación del servidor con límite de tiempo.
 * Si se excede, se informa como "sin confirmar" (nunca como éxito).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new AppError(
            'timeout',
            'El servidor no respondió a tiempo. Revisa tu conexión y consulta "Mis pedidos" antes de volver a intentarlo.',
          ),
        ),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AppError('offline', OFFLINE_MESSAGE);
  }
}
