import { useMemo, useState } from 'react';
import { CheckCircle2, UserRound } from 'lucide-react';
import { useAllStudents, useFamilies, useOrdersByDate, useSettings } from '../../hooks/useData';
import { useSubscription } from '../../hooks/useSubscription';
import { useReadySession } from '../../hooks/useSession';
import { watchMenuDay } from '../../services/menu';
import { placeOrders } from '../../services/orders';
import { capitalize, formatLongDate, isISODate } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { formatMoney } from '../../lib/money';
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceType } from '../../config/business';
import { ErrorState, LoadingState } from '../../components/StateMessage';
import { SearchInput } from '../../components/SearchInput';
import { matches } from '../../lib/text';
import { ServiceIcon } from '../../components/ServiceIcon';
import type { MenuDay, Student } from '../../types/models';
import { useAdminDate } from './useAdminDate';

export function ManualOrderPage() {
  const session = useReadySession();
  const [date, setDate] = useAdminDate();
  const students = useAllStudents();
  const families = useFamilies();
  const orders = useOrdersByDate(date);
  const settings = useSettings();
  const menu = useSubscription<MenuDay | null>(`menuDay:${date}`, (onData, onError) => watchMenuDay(date, onData, onError));

  const [search, setSearch] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [services, setServices] = useState<Set<ServiceType>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  const familyName = useMemo(() => new Map((families.data ?? []).map((f) => [f.id, f.name])), [families.data]);
  const candidates = useMemo(
    () =>
      (students.data ?? [])
        .filter((s) => s.active)
        .filter((s) => !search.trim() || matches(s.name, search) || matches(familyName.get(s.familyId) ?? '', search))
        .slice(0, 12),
    [students.data, search, familyName],
  );

  const existing = (svc: ServiceType) =>
    student ? (orders.data ?? []).find((o) => o.studentId === student.id && o.service === svc && o.status === 'active') : undefined;

  function toggle(svc: ServiceType) {
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(svc)) next.delete(svc);
      else next.add(svc);
      return next;
    });
  }

  function pickStudent(s: Student) {
    setStudent(s);
    setServices(new Set());
    setResult(null);
  }

  async function submit() {
    if (!student) return;
    setBusy(true);
    setResult(null);
    const created: string[] = [];
    const duplicated: string[] = [];
    try {
      for (const svc of services) {
        const r = await placeOrders({ date, service: svc, students: [student], uid: session.user.uid, source: 'admin' });
        if (r.confirmed.length) created.push(SERVICE_LABELS[svc].lower);
        if (r.alreadyActive.length) duplicated.push(SERVICE_LABELS[svc].lower);
      }
      const parts = [];
      if (created.length) parts.push(`Registrado: ${created.join(' y ')} para ${student.name}.`);
      if (duplicated.length) parts.push(`${student.name} ya tenía pedido de ${duplicated.join(' y ')}; no se duplicó.`);
      setResult({ tone: created.length ? 'success' : 'info', text: parts.join(' ') });
      setServices(new Set());
    } catch (err) {
      const partial = created.length ? ` (Sí se registró: ${created.join(' y ')}.)` : '';
      setResult({ tone: 'danger', text: `${describeError(err)}${partial}` });
    } finally {
      setBusy(false);
    }
  }

  const loadError = students.error ?? families.error ?? orders.error;

  return (
    <div className="stack-lg" style={{ maxWidth: '44rem' }}>
      <div className="stack-sm">
        <h1>Registrar pedido manual</h1>
        <p className="muted">Para pedidos recibidos por teléfono. Administración puede registrar aunque el horario de padres ya haya cerrado.</p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="manual-date">
          1. Fecha
        </label>
        <input
          id="manual-date"
          type="date"
          className="input"
          value={date}
          onChange={(e) => isISODate(e.target.value) && setDate(e.target.value)}
          style={{ maxWidth: '14rem' }}
        />
        <span className="field__hint">{capitalize(formatLongDate(date))}</span>
        {menu.data === null && !menu.loading && <p className="banner banner--warning">No hay menú capturado para este día.</p>}
        {menu.data?.noService && <p className="banner banner--warning">Este día está marcado como “Sin servicio”.</p>}
      </div>

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      ) : students.loading || families.loading ? (
        <LoadingState />
      ) : (
        <div className="stack">
          <span className="field__label">2. Alumno</span>
          {student ? (
            <div className="card card--flat spread">
              <span className="row">
                <UserRound size={22} aria-hidden="true" />
                <span>
                  <strong>{student.name}</strong>
                  <br />
                  <span className="muted small">{familyName.get(student.familyId)}</span>
                </span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStudent(null)}>
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <SearchInput value={search} onChange={setSearch} label="Buscar alumno o familia" />
              <ul className="list card card--flat" style={{ padding: 'var(--space-2) var(--space-4)' }}>
                {candidates.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="list-row btn--ghost" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => pickStudent(s)}>
                      <span className="grow">
                        <strong>{s.name}</strong>
                        <br />
                        <span className="muted small">{familyName.get(s.familyId)}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {candidates.length === 0 && <li className="list-row muted">Sin resultados.</li>}
              </ul>
            </>
          )}
        </div>
      )}

      {student && (
        <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }} disabled={busy}>
          <legend className="field__label" style={{ marginBottom: 'var(--space-2)' }}>
            3. Servicio
          </legend>
          {SERVICE_TYPES.map((svc) => {
            const has = existing(svc);
            return (
              <label key={svc} className="check-card">
                <input type="checkbox" checked={Boolean(has) || services.has(svc)} disabled={Boolean(has)} onChange={() => toggle(svc)} />
                <ServiceIcon service={svc} />
                <span className="grow">
                  {SERVICE_LABELS[svc].singular}
                  {settings.data && <span className="muted"> · {formatMoney(settings.data.prices[svc])}</span>}
                </span>
                {has && (
                  <span className="badge badge--success">
                    <CheckCircle2 size={14} aria-hidden="true" /> Ya lo tiene
                  </span>
                )}
                {!has && menu.data && !menu.data.noService && !menu.data[svc].available && (
                  <span className="badge badge--neutral">No disponible en menú</span>
                )}
              </label>
            );
          })}
        </fieldset>
      )}

      {result && (
        <p className={`banner banner--${result.tone}`} role={result.tone === 'danger' ? 'alert' : 'status'}>
          {result.text}
        </p>
      )}

      {student && (
        <button type="button" className="btn btn--primary btn--lg" disabled={busy || services.size === 0} onClick={submit} style={{ alignSelf: 'flex-start' }}>
          {busy ? 'Registrando…' : 'Registrar pedido'}
        </button>
      )}
    </div>
  );
}
