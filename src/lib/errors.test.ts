import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, assertOnline, describeError, isOfflineError, withTimeout } from './errors';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('conectividad', () => {
  it('assertOnline lanza un error "offline" si el navegador no tiene red', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(() => assertOnline()).toThrow(AppError);
    try {
      assertOnline();
    } catch (err) {
      expect(isOfflineError(err)).toBe(true);
      expect(describeError(err)).toMatch(/NO se ha enviado/);
    }
  });

  it('withTimeout rechaza (nunca resuelve) si el servidor no confirma a tiempo', async () => {
    vi.useFakeTimers();
    const never = new Promise<void>(() => {});
    const p = withTimeout(never, 1000);
    vi.advanceTimersByTime(1001);
    await expect(p).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('errores de Firestore se traducen a mensajes claros', () => {
    expect(describeError({ code: 'permission-denied' })).toMatch(/horario/);
    expect(isOfflineError({ code: 'unavailable' })).toBe(true);
  });
});
