import type { User } from 'firebase/auth';
import { UserX } from 'lucide-react';
import { PhoneLink } from '../../components/PhoneLink';
import { signOut } from '../../services/auth';
import { AuthShell } from './AuthShell';

export function NoAccessPage({ user }: { user: User }) {
  return (
    <AuthShell>
      <div className="stack center">
        <div className="state__icon" style={{ alignSelf: 'center' }} aria-hidden="true">
          <UserX size={30} />
        </div>
        <h1>No encontramos alumnos asociados a este correo</h1>
        <p>Comunícate con el Instituto para verificar tus datos.</p>
        <p className="muted">
          Entraste como <strong>{user.email}</strong>.
        </p>
        <p>
          Teléfono: <PhoneLink />
        </p>
      </div>
      <button type="button" className="btn btn--secondary btn--block" onClick={() => signOut()}>
        Entrar con otro correo
      </button>
    </AuthShell>
  );
}
