import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';

const api = {
  signInWithGoogle: vi.fn(),
  signInWithPassword: vi.fn(),
  createPasswordAccount: vi.fn(),
  sendPasswordReset: vi.fn(),
  resendVerification: vi.fn(),
  refreshVerification: vi.fn(),
  signOut: vi.fn(),
};
vi.mock('../../services/auth', () => ({ ...api, MIN_PASSWORD_LENGTH: 8 }));

const { LoginPage } = await import('./LoginPage');
const { VerifyEmailPage } = await import('./VerifyEmailPage');

afterEach(() => {
  cleanup();
  Object.values(api).forEach((f) => f.mockReset());
});

describe('Pantalla de acceso', () => {
  it('muestra solo dos opciones: Google y correo, sin términos técnicos', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /Continuar con Google/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar con correo/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Contraseña/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/firebase|token|email_verified|authentication/i);
  });

  it('"Olvidé mi contraseña" responde con un mensaje neutral', async () => {
    api.sendPasswordReset.mockResolvedValue(undefined);
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /Entrar con correo/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Olvidé mi contraseña' }));
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'alguien@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(api.sendPasswordReset).toHaveBeenCalledWith('alguien@ejemplo.com');
    expect(await screen.findByText(/Si hay una cuenta con ese correo/)).toBeInTheDocument();
  });

  it('primera vez: crea la contraseña con el correo escrito', async () => {
    api.createPasswordAccount.mockResolvedValue(undefined);
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /Entrar con correo/ }));
    await userEvent.click(screen.getByRole('button', { name: /Primera vez/ }));
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'papa@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'segura123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear contraseña' }));
    expect(api.createPasswordAccount).toHaveBeenCalledWith('papa@ejemplo.com', 'segura123');
  });
});

describe('Verifica tu correo', () => {
  const user = { email: 'papa@ejemplo.com' } as User;

  it('ofrece verificar, reenviar y cerrar sesión', async () => {
    api.refreshVerification.mockResolvedValue(false);
    render(<VerifyEmailPage user={user} />);
    expect(screen.getByRole('heading', { name: 'Verifica tu correo' })).toBeInTheDocument();
    expect(screen.getByText('papa@ejemplo.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ya verifiqué mi correo' }));
    expect(api.refreshVerification).toHaveBeenCalledWith(user);
    expect(await screen.findByText(/Todavía no aparece como verificado/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reenviar correo de verificación' }));
    expect(api.resendVerification).toHaveBeenCalledWith(user);

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(api.signOut).toHaveBeenCalled();
  });
});
