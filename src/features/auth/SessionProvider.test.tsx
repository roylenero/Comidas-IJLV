import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useSession } from '../../hooks/useSession';

// ---- dobles de Firebase ----
let tokenListener: ((u: User | null) => void) | null = null;
vi.mock('firebase/auth', () => ({
  getRedirectResult: () => Promise.resolve(null),
  onIdTokenChanged: (_auth: unknown, cb: (u: User | null) => void) => {
    tokenListener = cb;
    return () => {};
  },
}));
vi.mock('../../firebase/app', () => ({ auth: {}, db: {} }));

const resolveAccess = vi.fn();
const family = { id: 'fam-a', name: 'Familia Demo 1', active: true };
const students = [{ id: 'mateo', name: 'Mateo Demo', familyId: 'fam-a', active: true }];
vi.mock('../../services/access', () => ({
  resolveAccess: (user: User) => resolveAccess(user),
  watchFamily: (_id: string, onData: (f: unknown) => void) => {
    onData(family);
    return () => {};
  },
  watchFamilyStudents: (_id: string, onData: (s: unknown) => void) => {
    onData(students);
    return () => {};
  },
}));

const { SessionProvider } = await import('./SessionProvider');

function Probe() {
  const s = useSession();
  return <p data-testid="status">{s.status === 'ready' ? `ready:${s.familyId}:${s.students.map((x) => x.name).join(',')}` : s.status}</p>;
}

function fakeUser(email: string, emailVerified: boolean, providerId = 'password'): User {
  return { uid: 'uid-1', email, emailVerified, providerData: [{ providerId }] } as unknown as User;
}

async function emit(user: User | null) {
  await act(async () => {
    tokenListener?.(user);
    await Promise.resolve();
  });
}

const status = () => screen.getByTestId('status').textContent;

afterEach(() => {
  cleanup();
  resolveAccess.mockReset();
});

describe('SessionProvider: autenticarse no es estar autorizado', () => {
  it('A. correo sin verificar: estado "unverified" y NO se consulta ninguna familia', async () => {
    render(<SessionProvider><Probe /></SessionProvider>);
    await emit(fakeUser('papa.a@demo.test', false));
    expect(status()).toBe('unverified');
    expect(resolveAccess).not.toHaveBeenCalled();
  });

  it('B. correo verificado y autorizado: carga su familia e hijos', async () => {
    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: 'fam-a' });
    render(<SessionProvider><Probe /></SessionProvider>);
    await emit(fakeUser('papa.a@demo.test', true));
    expect(await screen.findByText('ready:fam-a:Mateo Demo')).toBeInTheDocument();
  });

  it('C. correo verificado sin familia: "noAccess" (no se crea ni se vincula nada)', async () => {
    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: null });
    render(<SessionProvider><Probe /></SessionProvider>);
    await emit(fakeUser('nadie@demo.test', true));
    expect(await screen.findByText('noAccess')).toBeInTheDocument();
  });

  it('G. Google y correo+contraseña pasan por la MISMA autorización', async () => {
    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: 'fam-a' });
    render(<SessionProvider><Probe /></SessionProvider>);
    await emit(fakeUser('papa.a@demo.test', true, 'google.com'));
    expect(await screen.findByText('ready:fam-a:Mateo Demo')).toBeInTheDocument();
    expect(resolveAccess).toHaveBeenCalledTimes(1);

    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: null });
    await emit(fakeUser('otro@gmail.com', true, 'google.com'));
    expect(await screen.findByText('noAccess')).toBeInTheDocument();
  });

  it('H. si cambia el correo de la sesión, la autorización se vuelve a validar y no se hereda', async () => {
    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: 'fam-a' });
    const user = fakeUser('papa.a@demo.test', true);
    render(<SessionProvider><Probe /></SessionProvider>);
    await emit(user);
    expect(await screen.findByText('ready:fam-a:Mateo Demo')).toBeInTheDocument();

    // Firebase notifica con el MISMO objeto User, ahora con otro correo.
    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: null });
    (user as unknown as { email: string }).email = 'correo.nuevo@demo.test';
    await emit(user);
    expect(await screen.findByText('noAccess')).toBeInTheDocument();
    expect(resolveAccess).toHaveBeenCalledTimes(2);
  });

  it('H2. si el correo nuevo aún no está verificado, se bloquea de inmediato', async () => {
    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: 'fam-a' });
    render(<SessionProvider><Probe /></SessionProvider>);
    await emit(fakeUser('papa.a@demo.test', true));
    expect(await screen.findByText('ready:fam-a:Mateo Demo')).toBeInTheDocument();
    await emit(fakeUser('papa.b@demo.test', false));
    expect(status()).toBe('unverified');
  });

  it('cerrar sesión regresa a la pantalla de acceso', async () => {
    resolveAccess.mockResolvedValue({ isAdmin: false, familyId: 'fam-a' });
    render(<SessionProvider><Probe /></SessionProvider>);
    await emit(fakeUser('papa.a@demo.test', true));
    await emit(null);
    expect(status()).toBe('signedOut');
  });
});
