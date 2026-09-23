import { useMemo, useState, type FormEvent } from 'react';
import { FileUp, Plus } from 'lucide-react';
import { useAllStudents, useAuthorizedEmails, useFamilies } from '../../hooks/useData';
import { describeError } from '../../lib/errors';
import { matches } from '../../lib/text';
import { createFamily } from '../../services/families';
import { ErrorState, LoadingState, StateMessage } from '../../components/StateMessage';
import type { Student } from '../../types/models';
import { SearchInput } from '../../components/SearchInput';
import { Sheet } from '../../components/Sheet';
import { FamilyCard } from './FamilyCard';
import { ImportCsvSheet } from './ImportCsvSheet';

export function FamiliesPage() {
  const families = useFamilies();
  const students = useAllStudents();
  const emails = useAuthorizedEmails();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const byFamily = useMemo(() => {
    const s = new Map<string, Student[]>();
    for (const st of students.data ?? []) s.set(st.familyId, [...(s.get(st.familyId) ?? []), st]);
    const e = new Map<string, string[]>();
    for (const em of emails.data ?? []) e.set(em.familyId, [...(e.get(em.familyId) ?? []), em.email].sort());
    return { students: s, emails: e };
  }, [students.data, emails.data]);

  const visible = (families.data ?? []).filter(
    (f) =>
      !search.trim() ||
      matches(f.name, search) ||
      (byFamily.students.get(f.id) ?? []).some((s) => matches(s.name, search)) ||
      (byFamily.emails.get(f.id) ?? []).some((e) => matches(e, search)),
  );

  const error = families.error ?? students.error ?? emails.error;
  const loading = families.loading || students.loading || emails.loading;
  const activeStudents = (students.data ?? []).filter((s) => s.active).length;

  return (
    <div className="stack-lg">
      <div className="spread" style={{ flexWrap: 'wrap' }}>
        <div className="stack-sm">
          <h1>Familias y alumnos</h1>
          {!loading && !error && (
            <p className="muted">
              {(families.data ?? []).length} familias · {activeStudents} alumnos activos
            </p>
          )}
        </div>
        <div className="row-wrap">
          <button type="button" className="btn btn--secondary" onClick={() => setImporting(true)} disabled={loading}>
            <FileUp size={20} aria-hidden="true" /> Importar CSV
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Plus size={20} aria-hidden="true" /> Nueva familia
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : loading ? (
        <LoadingState />
      ) : (families.data ?? []).length === 0 ? (
        <StateMessage title="Aún no hay familias">
          <p>Agrega una familia o importa la lista completa desde un archivo CSV.</p>
        </StateMessage>
      ) : (
        <>
          <SearchInput value={search} onChange={setSearch} label="Buscar familia, alumno o correo" />
          <div className="stack-sm">
            {visible.map((f) => (
              <FamilyCard key={f.id} family={f} students={byFamily.students.get(f.id) ?? []} emails={byFamily.emails.get(f.id) ?? []} />
            ))}
            {visible.length === 0 && <p className="muted">Sin resultados para “{search}”.</p>}
          </div>
        </>
      )}

      <NewFamilySheet open={creating} onClose={() => setCreating(false)} />
      <ImportCsvSheet
        open={importing}
        onClose={() => setImporting(false)}
        existing={{
          families: (families.data ?? []).map((f) => ({ id: f.id, name: f.name })),
          students: (students.data ?? []).map((s) => ({ familyId: s.familyId, name: s.name })),
          emails: emails.data ?? [],
        }}
      />
    </div>
  );
}

function NewFamilySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [emailsText, setEmailsText] = useState('');
  const [studentsText, setStudentsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setName('');
    setEmailsText('');
    setStudentsText('');
    setError(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createFamily({
        name,
        emails: emailsText.split(/[\s,;|]+/).filter(Boolean),
        studentNames: studentsText.split('\n'),
      });
      close();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      title="Nueva familia"
      onClose={close}
      dismissible={!busy}
      footer={
        <button type="submit" form="new-family" className="btn btn--primary btn--block btn--lg" disabled={busy || !name.trim()}>
          {busy ? 'Guardando…' : 'Crear familia'}
        </button>
      }
    >
      <form id="new-family" className="stack" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="nf-name">
            Nombre o identificador
          </label>
          <input id="nf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Familia López Pérez" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="nf-emails">
            Correos autorizados
          </label>
          <textarea id="nf-emails" className="textarea" rows={2} value={emailsText} onChange={(e) => setEmailsText(e.target.value)} />
          <span className="field__hint">Uno o varios, separados por coma o salto de línea.</span>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="nf-students">
            Alumnos
          </label>
          <textarea id="nf-students" className="textarea" rows={3} value={studentsText} onChange={(e) => setStudentsText(e.target.value)} />
          <span className="field__hint">Un nombre por línea.</span>
        </div>
        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
