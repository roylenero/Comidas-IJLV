import { useState, type FormEvent } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { APP_SHORT_NAME, INSTITUTION_NAME } from '../../config/business';
import { describeError } from '../../lib/errors';
import {
  createPasswordAccount,
  MIN_PASSWORD_LENGTH,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
} from '../../services/auth';
import { AuthShell } from './AuthShell';

type Step = 'choose' | 'signin' | 'create' | 'forgot';

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

const TITLES: Record<Exclude<Step, 'choose'>, string> = {
  signin: 'Entrar con correo',
  create: 'Crear tu contraseña',
  forgot: 'Olvidé mi contraseña',
};

export function LoginPage({ redirectError }: { redirectError?: string | null }) {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(redirectError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  function go(next: Step) {
    setStep(next);
    setError(null);
    setNotice(null);
    setPassword('');
  }

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
    if (step === 'signin') run(() => signInWithPassword(email, password));
    if (step === 'create') run(() => createPasswordAccount(email, password));
    if (step === 'forgot')
      run(async () => {
        await sendPasswordReset(email);
        setNotice(
          'Si hay una cuenta con ese correo, te enviamos un mensaje para crear una contraseña nueva. Revisa también el correo no deseado.',
        );
      });
  }

  const messages = (
    <>
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
    </>
  );

  if (step === 'choose') {
    return (
      <AuthShell>
        <div className="stack-sm center">
          <h1>{APP_SHORT_NAME}</h1>
          <p className="muted">Pedidos de desayuno y comida del {INSTITUTION_NAME}.</p>
        </div>
        <button type="button" className="btn btn--secondary btn--block btn--lg" onClick={() => run(signInWithGoogle)} disabled={busy}>
          <GoogleIcon /> Continuar con Google
        </button>
        <div className="row" aria-hidden="true">
          <hr className="divider grow" />
          <span className="muted small">o</span>
          <hr className="divider grow" />
        </div>
        <button type="button" className="btn btn--secondary btn--block btn--lg" onClick={() => go('signin')} disabled={busy}>
          <Mail size={20} aria-hidden="true" /> Entrar con correo
        </button>
        <p className="muted small center">Usa el correo que registraste en el Instituto.</p>
        {messages}
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => go(step === 'signin' ? 'choose' : 'signin')}>
        <ArrowLeft size={18} aria-hidden="true" /> Volver
      </button>
      <h1>{TITLES[step]}</h1>
      {step === 'create' && <p className="muted">Te enviaremos un mensaje a tu correo para confirmar que es tuyo.</p>}
      {step === 'forgot' && <p className="muted">Te enviaremos un mensaje para crear una contraseña nueva.</p>}

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
        {step !== 'forgot' && (
          <div className="field">
            <label className="field__label" htmlFor="password">
              {step === 'signin' ? 'Contraseña' : 'Nueva contraseña'}
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={step === 'signin' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={step === 'create' ? 'password-hint' : undefined}
            />
            {step === 'create' && (
              <span id="password-hint" className="field__hint">
                Mínimo {MIN_PASSWORD_LENGTH} caracteres.
              </span>
            )}
          </div>
        )}

        {messages}

        <button
          type="submit"
          className="btn btn--primary btn--block btn--lg"
          disabled={busy || !email.trim() || (step !== 'forgot' && !password)}
        >
          {busy ? 'Un momento…' : step === 'signin' ? 'Entrar' : step === 'create' ? 'Crear contraseña' : 'Enviar mensaje'}
        </button>
      </form>

      {step === 'signin' && (
        <div className="stack-sm">
          <button type="button" className="btn btn--ghost" onClick={() => go('forgot')}>
            Olvidé mi contraseña
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => go('create')}>
            ¿Primera vez? Crear contraseña
          </button>
        </div>
      )}
      {step === 'create' && (
        <button type="button" className="btn btn--ghost" onClick={() => go('signin')}>
          Ya tengo contraseña
        </button>
      )}
    </AuthShell>
  );
}
