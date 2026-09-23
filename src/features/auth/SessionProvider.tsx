import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getRedirectResult, onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase/app';
import { resolveAccess, watchFamily, watchFamilyStudents } from '../../services/access';
import { describeError } from '../../lib/errors';
import type { Family, Student } from '../../types/models';
import { SessionContext, type Session } from '../../hooks/useSession';

/**
 * Foto de la identidad en cada cambio de token. Se guarda como objeto NUEVO porque
 * Firebase entrega el mismo objeto User aunque cambie el correo o la verificación.
 */
interface Identity {
  user: User;
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

type AccessResult =
  | { key: string; status: 'error'; message: string }
  | { key: string; status: 'resolved'; isAdmin: boolean; familyId: string | null };

interface FamilyData {
  key: string;
  family?: Family | null;
  students?: Student[];
  error?: string;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => setRedirectError(describeError(err)));
    return onIdTokenChanged(auth, (u) =>
      setIdentity(u ? { user: u, uid: u.uid, email: u.email, emailVerified: u.emailVerified } : null),
    );
  }, []);

  // La autorización se recalcula si cambia la cuenta, el correo o su verificación.
  // Nada se hereda de un correo anterior.
  const accessKey =
    identity && identity.email && identity.emailVerified ? `${identity.uid}|${identity.email}|${retryKey}` : null;
  const access = accessResult && accessResult.key === accessKey ? accessResult : null;

  useEffect(() => {
    if (!accessKey || !identity) return;
    let cancelled = false;
    resolveAccess(identity.user)
      .then((info) => !cancelled && setAccessResult({ key: accessKey, status: 'resolved', ...info }))
      .catch((err) => !cancelled && setAccessResult({ key: accessKey, status: 'error', message: describeError(err) }));
    return () => {
      cancelled = true;
    };
    // accessKey codifica uid, correo y verificación de `identity`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessKey]);

  const familyId = access?.status === 'resolved' ? access.familyId : null;
  const familyKey = familyId && accessKey ? `${familyId}|${accessKey}` : null;
  const current = familyData && familyData.key === familyKey ? familyData : null;

  useEffect(() => {
    if (!familyId || !familyKey) return;
    const merge = (patch: Partial<FamilyData>) =>
      setFamilyData((prev) => ({ ...(prev?.key === familyKey ? prev : { key: familyKey }), ...patch }));
    const onError = (err: Error) => merge({ error: describeError(err) });
    const unsubFamily = watchFamily(familyId, (family) => merge({ family }), onError);
    const unsubStudents = watchFamilyStudents(familyId, (students) => merge({ students }), onError);
    return () => {
      unsubFamily();
      unsubStudents();
    };
  }, [familyId, familyKey]);

  const session = useMemo<Session>(() => {
    const retry = () => setRetryKey((k) => k + 1);
    if (identity === undefined) return { status: 'loading' };
    if (identity === null) return { status: 'signedOut', redirectError };
    const { user } = identity;
    // Sin correo verificado no se consulta ni se muestra ningún dato familiar.
    if (!identity.email || !identity.emailVerified) return { status: 'unverified', user };
    if (!access) return { status: 'loading' };
    if (access.status === 'error') return { status: 'error', user, message: access.message, retry };

    if (access.familyId) {
      if (current?.error) return { status: 'error', user, message: current.error, retry };
      if (current?.family === undefined || current?.students === undefined) return { status: 'loading' };
    }
    const family = access.familyId && current?.family?.active ? current.family : null;
    const students = family ? current!.students! : [];

    if (!access.isAdmin && (!family || students.length === 0)) return { status: 'noAccess', user };

    return {
      status: 'ready',
      user,
      email: identity.email,
      isAdmin: access.isAdmin,
      familyId: family ? family.id : null,
      family,
      students,
      retry,
    };
  }, [identity, access, current, redirectError]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
