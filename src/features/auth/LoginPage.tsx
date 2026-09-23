import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { APP_SHORT_NAME, INSTITUTION_NAME } from '../../config/business';
import { describeError } from '../../lib/errors';
import { createPasswordAccount, sendPasswordReset, signInWithGoogle, signInWithPassword } from '../../services/auth';
import { AuthShell } from './AuthShell';

type Mode = 'signin' | 'create';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function LoginPage({ redirectError }: { redirectError?: string | null }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(redirectError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(() => (mode === 'signin' ? signInWithPassword(email, password) : createPasswordAccount(email, password)));
  }

  function onForgot() {
    if (!email.trim()) {
      setError('Escribe tu correo arriba y vuelve a tocar "Olvidé mi contraseña".');
      return;
    }
    run(async () => {
      await sendPasswordReset(email);
      setNotice(`Si ${email.trim()} tiene cuenta, te enviamos un correo para crear una contraseña nueva. Revisa también "Spam".`);
    });
  }

  return (
    <AuthShell>
      <div className="stack-sm center">
        <h1>{APP_SHORT_NAME}</h1>
        <p className="muted">Pedidos de desayuno y comida del {INSTITUTION_NAME}.</p>
      </div>

      <div className="banner banner--info">
        <Mail size={18} aria-hidden="true" />
        <span>Entra con el correo que registraste en el Instituto. Solo lo harás una vez en este dispositivo.</span>
      </div>

      <button type="button" className="btn btn--secondary btn--block btn--lg" onClick={() => run(signInWithGoogle)} disabled={busy}>
        <GoogleIcon /> Continuar con Google
      </button>

      <div className="row" aria-hidden="true">
        <hr className="divider grow" />
        <span className="muted small">o con correo y contraseña</span>
        <hr className="divider grow" />
      </div>

      <div className="segmented" role="group" aria-label="Tipo de acceso" style={{ alignSelf: 'stretch' }}>
        <button type="button" className="grow" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>
          Ya tengo contraseña
        </button>
        <button type="button" className="grow" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
          Primera vez
        </button>
      </div>

      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="password">
            {mode === 'signin' ? 'Contraseña' : 'Crea una contraseña'}
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === 'create' ? 'password-hint' : undefined}
          />
          {mode === 'create' && (
            <span id="password-hint" className="field__hint">
              Mínimo 6 caracteres. Te enviaremos un correo para confirmar que es tuyo.
            </span>
          )}
        </div>

        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="banner banner--success" role="status">
            {notice}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy || !email || !password}>
          {busy ? 'Un momento…' : mode === 'signin' ? 'Entrar' : 'Crear contraseña y entrar'}
        </button>
        {mode === 'signin' && (
          <button type="button" className="btn btn--ghost" onClick={onForgot} disabled={busy}>
            Olvidé mi contraseña
          </button>
        )}
      </form>
    </AuthShell>
  );
}
