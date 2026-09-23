import { useState } from 'react';
import type { User } from 'firebase/auth';
import { MailCheck } from 'lucide-react';
import { describeError } from '../../lib/errors';
import { refreshVerification, resendVerification, signOut } from '../../services/auth';
import { AuthShell } from './AuthShell';

export function VerifyEmailPage({ user }: { user: User }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success' | 'info'; text: string } | null>(null);

  async function check() {
    setBusy(true);
    setMessage(null);
    try {
      const ok = await refreshVerification(user);
      if (!ok) setMessage({ tone: 'info', text: 'Todavía no vemos tu confirmación. Abre el correo y toca el enlace; luego vuelve aquí.' });
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
      setMessage({ tone: 'success', text: 'Te enviamos un nuevo correo. Revisa también la carpeta "Spam".' });
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
        <h1>Confirma tu correo</h1>
        <p>
          Enviamos un enlace a <strong>{user.email}</strong>. Ábrelo y después toca <strong>"Ya confirmé mi correo"</strong>.
        </p>
      </div>
      {message && (
        <p className={`banner banner--${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={check} disabled={busy}>
        Ya confirmé mi correo
      </button>
      <button type="button" className="btn btn--secondary btn--block" onClick={resend} disabled={busy}>
        Reenviar correo
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={() => signOut()}>
        Usar otro correo
      </button>
    </AuthShell>
  );
}
