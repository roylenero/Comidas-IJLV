import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppError, OFFLINE_MESSAGE } from '../../lib/errors';
import type { Student } from '../../types/models';

const placeOrders = vi.fn();
vi.mock('../../services/orders', () => ({ placeOrders: (...args: unknown[]) => placeOrders(...args) }));

const { OrderSheet } = await import('./OrderSheet');

const students: Student[] = [
  { id: 'mateo', name: 'Mateo Demo', familyId: 'f1', active: true },
  { id: 'sofia', name: 'Sofía Demo', familyId: 'f1', active: true },
];

function renderSheet(alreadyOrdered = new Set<string>()) {
  return render(
    <OrderSheet
      open
      date="2031-03-03"
      service="lunch"
      price={70}
      students={students}
      alreadyOrdered={alreadyOrdered}
      uid="u1"
      onClose={() => {}}
    />,
  );
}

beforeAll(() => {
  // jsdom no implementa <dialog>.showModal
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  placeOrders.mockReset();
  vi.restoreAllMocks();
});

describe('OrderSheet', () => {
  it('22. dos hijos: resumen y total correctos y se envían ambos', async () => {
    placeOrders.mockResolvedValue({
      confirmed: [
        { studentId: 'mateo', studentName: 'Mateo Demo', price: 70 },
        { studentId: 'sofia', studentName: 'Sofía Demo', price: 70 },
      ],
      alreadyActive: [],
    });
    renderSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mateo Demo' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sofía Demo' }));
    expect(screen.getByText('$140')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(placeOrders).toHaveBeenCalledWith(expect.objectContaining({ students: students, service: 'lunch', source: 'parent' }));
    expect(await screen.findByText('Pedido confirmado')).toBeInTheDocument();
  });

  it('20. sin internet NUNCA muestra "Pedido confirmado"', async () => {
    placeOrders.mockRejectedValue(new AppError('offline', OFFLINE_MESSAGE));
    renderSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mateo Demo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText(/El pedido NO se confirmó/)).toBeInTheDocument();
    expect(screen.queryByText('Pedido confirmado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });

  it('20b. mientras el servidor no responde, solo muestra "Enviando…"', async () => {
    placeOrders.mockReturnValue(new Promise(() => {}));
    renderSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mateo Demo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(screen.getByRole('button', { name: 'Enviando pedido…' })).toBeDisabled();
    expect(screen.queryByText('Pedido confirmado')).not.toBeInTheDocument();
  });

  it('20c. con el navegador sin red, el botón de confirmar está deshabilitado', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mateo Demo' }));
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument();
  });

  it('un hijo que ya tiene el servicio aparece bloqueado (sin duplicar)', () => {
    renderSheet(new Set(['mateo']));
    expect(screen.getByRole('checkbox', { name: /Mateo Demo/ })).toBeDisabled();
    expect(screen.getByText('Ya solicitado')).toBeInTheDocument();
    // Con un solo hijo disponible, se preselecciona.
    expect(screen.getByRole('checkbox', { name: 'Sofía Demo' })).toBeChecked();
  });

  it('muestra aviso si el servidor detecta que ya estaba pedido', async () => {
    placeOrders.mockResolvedValue({ confirmed: [], alreadyActive: [{ studentId: 'mateo', studentName: 'Mateo Demo' }] });
    renderSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mateo Demo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText(/ya tenía pedido de comida/)).toBeInTheDocument();
    expect(screen.queryByText('Pedido confirmado')).not.toBeInTheDocument();
  });
});
