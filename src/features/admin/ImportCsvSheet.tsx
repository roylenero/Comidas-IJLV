import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { describeError } from '../../lib/errors';
import { planImport, readImportCsv, type ExistingData, type ImportPlan } from '../../lib/importPlan';
import { applyImportPlan } from '../../services/families';

interface Props {
  open: boolean;
  existing: ExistingData;
  onClose: () => void;
}

export function ImportCsvSheet(props: Props) {
  return props.open ? <ImportCsvContent {...props} /> : null;
}

function ImportCsvContent({ existing, onClose }: Props) {
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [readErrors, setReadErrors] = useState<{ line: number; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDone(null);
    const text = await file.text();
    const { rows, errors } = readImportCsv(text);
    setReadErrors(errors);
    setPlan(planImport(rows, existing));
  }

  async function apply() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const r = await applyImportPlan(plan);
      setDone(`Listo: ${r.families} familias nuevas, ${r.students} alumnos y ${r.emails} correos autorizados.`);
      setPlan(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const errors = [...readErrors, ...(plan?.errors ?? [])].sort((a, b) => a.line - b.line);
  const totals = plan && {
    newFamilies: plan.families.filter((f) => !f.existingId).length,
    students: plan.families.reduce((n, f) => n + f.newStudents.length, 0),
    emails: plan.families.reduce((n, f) => n + f.newEmails.length, 0),
  };
  const canApply = plan && plan.families.length > 0 && errors.length === 0;

  return (
    <Sheet
      open
      title="Importar familias desde CSV"
      onClose={onClose}
      dismissible={!busy}
      footer={
        done ? (
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onClose}>
            Cerrar
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!canApply || busy} onClick={apply}>
            {busy ? 'Importando…' : 'Importar'}
          </button>
        )
      }
    >
      <p className="small">
        Columnas: <code>studentName</code>, <code>parentEmail</code>, <code>familyIdentifier</code>. Una fila por alumno. Los hermanos
        que comparten correo o identificador quedan en la misma familia. Varios correos en una celda: sepáralos con <code>|</code>. Hay
        una plantilla en <code>docs/plantilla-importacion.csv</code>.
      </p>

      <label className="btn btn--secondary">
        <FileUp size={20} aria-hidden="true" /> Elegir archivo CSV
        <input type="file" accept=".csv,text/csv" className="visually-hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {done && (
        <p className="banner banner--success" role="status">
          {done}
        </p>
      )}
      {error && (
        <p className="banner banner--danger" role="alert">
          {error}
        </p>
      )}

      {errors.length > 0 && (
        <div className="banner banner--danger" role="alert">
          <div className="stack-sm">
            <strong>Corrige estas filas y vuelve a cargar el archivo:</strong>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {errors.map((e, i) => (
                <li key={i}>
                  Fila {e.line}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {plan && totals && (
        <div className="stack-sm">
          <p>
            Se crearán <strong>{totals.newFamilies}</strong> familias, <strong>{totals.students}</strong> alumnos y{' '}
            <strong>{totals.emails}</strong> correos autorizados.
            {plan.skippedStudents > 0 && ` Se omiten ${plan.skippedStudents} alumnos que ya existían.`}
          </p>
          {plan.families.length === 0 && <p className="muted">No hay nada nuevo que importar.</p>}
          <ul className="list">
            {plan.families.map((f, i) => (
              <li key={i} className="list-row" style={{ display: 'block' }}>
                <strong>{f.name}</strong> {f.existingId ? <span className="badge badge--neutral">existente</span> : <span className="badge badge--info">nueva</span>}
                <div className="muted small">
                  {f.newStudents.join(', ') || 'sin alumnos nuevos'} · {f.newEmails.join(', ') || 'sin correos nuevos'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
