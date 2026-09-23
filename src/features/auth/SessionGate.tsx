import { Outlet } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { ErrorState, LoadingState } from '../../components/StateMessage';
import { signOut } from '../../services/auth';
import { LoginPage } from './LoginPage';
import { VerifyEmailPage } from './VerifyEmailPage';
import { NoAccessPage } from './NoAccessPage';
import { AuthShell } from './AuthShell';

/** Muestra login / verificación / sin acceso según el estado de la sesión. */
export function SessionGate() {
  const session = useSession();
  switch (session.status) {
    case 'loading':
      return <LoadingState />;
    case 'signedOut':
      return <LoginPage redirectError={session.redirectError} />;
    case 'unverified':
      return <VerifyEmailPage user={session.user} />;
    case 'noAccess':
      return <NoAccessPage user={session.user} />;
    case 'error':
      return (
        <AuthShell>
          <ErrorState message={session.message} onRetry={session.retry} />
          <button type="button" className="btn btn--ghost btn--block" onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </AuthShell>
      );
    case 'ready':
      return <Outlet />;
  }
}
