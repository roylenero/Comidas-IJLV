import { useState, type FormEvent } from 'react';
import { ChevronDown, Mail, Pencil, UserPlus, X } from 'lucide-react';
import { describeError } from '../../lib/errors';
import { addAuthorizedEmail, addStudent, removeAuthorizedEmail, updateFamily, updateStudent } from '../../services/families';
import type { Family, Student } from '../../types/models';

interface Props {
  family: Family;
  students: Student[];
  emails: string[];
}

export function FamilyCard({ family, students, emails }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newStudent, setNewStudent] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: string; name: string } | null>(null);
  const activeStudents = students.filter((s) => s.active).length;

  async function run(action: () => Promise<void>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const submit = (fn: () => Promise<void>, after: () => void) => (e: FormEvent) => {
    e.preventDefault();
    run(fn, after);
  };

  return (
    <details className="card card--flat family-card">
      <summary>
        <span className="grow">
          <strong>{family.name}</strong>
          <br />
          <span className="muted small">
            {activeStudents} {activeStudents === 1 ? 'alumno' : 'alumnos'} · {emails.length} {emails.length === 1 ? 'correo' : 'correos'}
          </span>
        </span>
        {!family.active && <span className="badge badge--neutral">Inactiva</span>}
        {emails.length === 0 && family.active && <span className="badge badge--warning">Sin correo</span>}
        <ChevronDown size={20} aria-hidden="true" />
      </summary>

      <fieldset className="stack" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}

        <div className="stack-sm">
          <span className="section-title">Familia</span>
          {editingName !== null ? (
            <form className="inline-form" onSubmit={submit(() => updateFamily(family.id, { name: editingName, active: family.active }), () => setEditingName(null))}>
              <label className="visually-hidden" htmlFor={`fn-${family.id}`}>
                Nombre o identificador de la familia
              </label>
              <input id={`fn-${family.id}`} className="input" value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
              <button className="btn btn--primary btn--sm" type="submit">
                Guardar
              </button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditingName(null)}>
                Cancelar
              </button>
            </form>
          ) : (
            <div className="row-wrap">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditingName(family.name)}>
                <Pencil size={16} aria-hidden="true" /> Renombrar
              </button>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={family.active}
                  onChange={(e) => run(() => updateFamily(family.id, { name: family.name, active: e.target.checked }))}
                />
                Familia activa
              </label>
            </div>
          )}
          {!family.active && <p className="muted small">Las familias inactivas no pueden iniciar sesión ni hacer pedidos.</p>}
        </div>

        <div className="stack-sm">
          <span className="section-title">Correos autorizados</span>
          <div className="row-wrap">
            {emails.map((email) => (
              <span key={email} className="chip">
                <Mail size={14} aria-hidden="true" /> {email}
                <button type="button" className="icon-btn" aria-label={`Quitar ${email}`} onClick={() => run(() => removeAuthorizedEmail(email))}>
                  <X size={16} />
                </button>
              </span>
            ))}
            {emails.length === 0 && <span className="muted small">Sin correos: nadie puede entrar por esta familia.</span>}
          </div>
          <form className="inline-form" onSubmit={submit(() => addAuthorizedEmail(family.id, newEmail), () => setNewEmail(''))}>
            <label className="visually-hidden" htmlFor={`ne-${family.id}`}>
              Agregar correo autorizado
            </label>
            <input
              id={`ne-${family.id}`}
              className="input"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="correo@ejemplo.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <button className="btn btn--secondary btn--sm" type="submit" disabled={!newEmail.trim()}>
              Agregar correo
            </button>
          </form>
        </div>

        <div className="stack-sm">
          <span className="section-title">Alumnos</span>
          <ul className="list">
            {students.map((s) => (
              <li key={s.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                {editingStudent?.id === s.id ? (
                  <form
                    className="inline-form grow"
                    onSubmit={submit(() => updateStudent(s.id, { name: editingStudent.name, active: s.active }), () => setEditingStudent(null))}
                  >
                    <label className="visually-hidden" htmlFor={`sn-${s.id}`}>
                      Nombre del alumno
                    </label>
                    <input
                      id={`sn-${s.id}`}
                      className="input"
                      value={editingStudent.name}
                      onChange={(e) => setEditingStudent({ id: s.id, name: e.target.value })}
                      autoFocus
                    />
                    <button className="btn btn--primary btn--sm" type="submit">
                      Guardar
                    </button>
                    <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditingStudent(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    <span className={`grow ${s.active ? '' : 'muted'}`}>
                      {s.name} {!s.active && <span className="badge badge--neutral">Baja</span>}
                    </span>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditingStudent({ id: s.id, name: s.name })}>
                      Editar<span className="visually-hidden"> {s.name}</span>
                    </button>
                    <label className="switch small">
                      <input type="checkbox" checked={s.active} onChange={(e) => run(() => updateStudent(s.id, { name: s.name, active: e.target.checked }))} />
                      Activo
                    </label>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form className="inline-form" onSubmit={submit(() => addStudent(family.id, newStudent), () => setNewStudent(''))}>
            <label className="visually-hidden" htmlFor={`ns-${family.id}`}>
              Nombre del nuevo alumno
            </label>
            <input id={`ns-${family.id}`} className="input" placeholder="Nombre del alumno" value={newStudent} onChange={(e) => setNewStudent(e.target.value)} />
            <button className="btn btn--secondary btn--sm" type="submit" disabled={!newStudent.trim()}>
              <UserPlus size={16} aria-hidden="true" /> Agregar alumno
            </button>
          </form>
        </div>
      </fieldset>
    </details>
  );
}
