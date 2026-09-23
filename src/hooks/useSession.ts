import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { Family, Student } from '../types/models';

export type Session =
  | { status: 'loading' }
  | { status: 'signedOut'; redirectError: string | null }
  | { status: 'unverified'; user: User }
  | { status: 'error'; user: User; message: string; retry: () => void }
  | { status: 'noAccess'; user: User }
  | {
      status: 'ready';
      user: User;
      email: string;
      isAdmin: boolean;
      familyId: string | null;
      family: Family | null;
      students: Student[];
      retry: () => void;
    };

export type ReadySession = Extract<Session, { status: 'ready' }>;

export const SessionContext = createContext<Session>({ status: 'loading' });

export function useSession(): Session {
  return useContext(SessionContext);
}

/** Para componentes que solo se montan con sesión lista (dentro de las rutas protegidas). */
export function useReadySession(): ReadySession {
  const session = useContext(SessionContext);
  if (session.status !== 'ready') throw new Error('useReadySession usado fuera de una sesión lista');
  return session;
}
