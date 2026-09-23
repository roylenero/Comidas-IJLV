import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getRedirectResult, onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase/app';
import { resolveAccess, watchFamily, watchFamilyStudents } from '../../services/access';
import { describeError } from '../../lib/errors';
import type { Family, Student } from '../../types/models';
import { SessionContext, type Session } from '../../hooks/useSession';

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
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => setRedirectError(describeError(err)));
    return onIdTokenChanged(auth, (u) => {
      setUser(u);
      setVerified(Boolean(u?.emailVerified));
    });
  }, []);

  const email = user?.email ?? null;

  // La clave evita mostrar el resultado de un correo anterior (o de un intento previo).
  const accessKey = email && verified ? `${email}#${retryKey}` : null;
  const access = accessResult && accessResult.key === accessKey ? accessResult : null;

  useEffect(() => {
    if (!accessKey || !email) return;
    let cancelled = false;
    resolveAccess(email)
      .then((info) => !cancelled && setAccessResult({ key: accessKey, status: 'resolved', ...info }))
      .catch((err) => !cancelled && setAccessResult({ key: accessKey, status: 'error', message: describeError(err) }));
    return () => {
      cancelled = true;
    };
  }, [accessKey, email]);

  const familyId = access?.status === 'resolved' ? access.familyId : null;
  const familyKey = familyId ? `${familyId}#${retryKey}` : null;
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
    if (user === undefined) return { status: 'loading' };
    if (user === null) return { status: 'signedOut', redirectError };
    if (!verified) return { status: 'unverified', user };
    if (!access) return { status: 'loading' };
    if (access.status === 'error') return { status: 'error', user, message: access.message, retry };

    const hasFamily = Boolean(access.familyId);
    if (hasFamily && current?.error) return { status: 'error', user, message: current.error, retry };
    const family = current?.family;
    const students = current?.students;
    if (hasFamily && (family === undefined || students === undefined)) return { status: 'loading' };
    const familyActive = hasFamily && family?.active === true;

    if (!access.isAdmin && (!familyActive || !students || students.length === 0)) {
      return { status: 'noAccess', user };
    }

    return {
      status: 'ready',
      user,
      email: user.email!,
      isAdmin: access.isAdmin,
      familyId: familyActive ? access.familyId : null,
      family: familyActive ? family! : null,
      students: familyActive ? students! : [],
      retry,
    };
  }, [user, verified, access, current, redirectError]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
