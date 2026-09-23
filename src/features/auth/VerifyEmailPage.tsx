import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { MailCheck } from 'lucide-react';
import { describeError } from '../../lib/errors';
import { refreshVerification, resendVerification, signOut } from '../../services/auth';
import { AuthShell } from './AuthShell';

/**
 * Cuenta de correo sin verificar: no se consulta ni se muestra ningún dato familiar
 * (y las reglas de Firestore tampoco lo permitirían).
 */
export function VerifyEmailPage({ user }: { user: User }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success' | 'info'; text: string } | null>(null);

  // Si el padre verificó en otra pestaña y vuelve a la app, se comprueba solo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshVerification(user).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user]);

  async function check() {
    setBusy(true);
    setMessage(null);
    try {
      const ok = await refreshVerification(user);
      if (!ok) setMessage({ tone: 'info', text: 'Todavía no aparece como verificado. Abre el mensaje, toca el enlace y vuelve a intentarlo.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setMessage(null);
    try {
      await resendVerification(user);
      setMessage({ tone: 'success', text: 'Te enviamos un nuevo mensaje. Revisa también el correo no deseado.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="stack center">
        <div className="state__icon" style={{ alignSelf: 'center' }} aria-hidden="true">
          <MailCheck size={30} />
        </div>
        <h1>Verifica tu correo</h1>
        <p>
          Enviamos un mensaje a <strong>{user.email}</strong>. Ábrelo, toca el enlace y después vuelve aquí.
        </p>
      </div>
      {message && (
        <p className={`banner banner--${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={check} disabled={busy}>
        Ya verifiqué mi correo
      </button>
      <button type="button" className="btn btn--secondary btn--block" onClick={resend} disabled={busy}>
        Reenviar correo de verificación
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={() => signOut()}>
        Cerrar sesión
      </button>
    </AuthShell>
  );
}
