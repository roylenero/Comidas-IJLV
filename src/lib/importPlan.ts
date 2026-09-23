import { normalizeEmail } from '../firebase/paths';
import { parseCsv } from './csv';

export interface ImportRow {
  line: number;
  studentName: string;
  emails: string[];
  familyIdentifier: string;
}

export interface ExistingData {
  families: { id: string; name: string }[];
  students: { familyId: string; name: string }[];
  emails: { email: string; familyId: string }[];
}

export interface PlannedFamily {
  /** Familia existente a reutilizar, o null si se creará. */
  existingId: string | null;
  name: string;
  newEmails: string[];
  newStudents: string[];
}

export interface ImportPlan {
  families: PlannedFamily[];
  errors: { line: number; message: string }[];
  skippedStudents: number;
}

const HEADER_ALIASES: Record<keyof Omit<ImportRow, 'line' | 'emails'> | 'parentEmail', string[]> = {
  studentName: ['studentname', 'alumno', 'nombre', 'nombrealumno', 'estudiante'],
  parentEmail: ['parentemail', 'correo', 'email', 'correopadre', 'correotutor'],
  familyIdentifier: ['familyidentifier', 'familia', 'family', 'idfamilia'],
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const simplify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
const nameKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Lee el CSV con columnas studentName, parentEmail, familyIdentifier (o sus equivalentes en español). */
export function readImportCsv(text: string): { rows: ImportRow[]; errors: { line: number; message: string }[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: 'El archivo está vacío.' }] };

  const header = table[0].map(simplify);
  const col = (key: keyof typeof HEADER_ALIASES) => header.findIndex((h) => HEADER_ALIASES[key].includes(h));
  const iName = col('studentName');
  const iEmail = col('parentEmail');
  const iFamily = col('familyIdentifier');
  if (iName < 0 || iEmail < 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'La primera fila debe tener los encabezados studentName, parentEmail y familyIdentifier.' }],
    };
  }

  const rows: ImportRow[] = [];
  const errors: { line: number; message: string }[] = [];
  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const studentName = cleanName(cells[iName] ?? '');
    const emails = (cells[iEmail] ?? '')
      .split(/[;|\s]+/)
      .map(normalizeEmail)
      .filter(Boolean);
    const familyIdentifier = cleanName(iFamily >= 0 ? (cells[iFamily] ?? '') : '');
    if (!studentName) errors.push({ line, message: 'Falta el nombre del alumno.' });
    if (emails.length === 0) errors.push({ line, message: 'Falta el correo del padre o madre.' });
    const bad = emails.filter((e) => !EMAIL_RE.test(e));
    if (bad.length) errors.push({ line, message: `Correo inválido: ${bad.join(', ')}` });
    if (studentName && emails.length && !bad.length) rows.push({ line, studentName, emails, familyIdentifier });
  });
  return { rows, errors };
}

/**
 * Agrupa filas en familias. Dos filas son la misma familia si comparten
 * familyIdentifier o algún correo. Reutiliza familias existentes (por correo o nombre)
 * y omite alumnos que ya existen en esa familia.
 */
export function planImport(rows: ImportRow[], existing: ExistingData): ImportPlan {
  const errors: ImportPlan['errors'] = [];

  // Union-find sencillo sobre filas.
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const byKey = new Map<string, number>();
  rows.forEach((row, i) => {
    const keys = [...row.emails.map((e) => `e:${e}`), ...(row.familyIdentifier ? [`f:${nameKey(row.familyIdentifier)}`] : [])];
    for (const key of keys) {
      const prev = byKey.get(key);
      if (prev === undefined) byKey.set(key, i);
      else union(i, prev);
    }
  });

  const groups = new Map<number, ImportRow[]>();
  rows.forEach((row, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), row]);
  });

  const emailOwner = new Map(existing.emails.map((e) => [e.email, e.familyId]));
  const familyByName = new Map(existing.families.map((f) => [nameKey(f.name), f.id]));
  const familyName = new Map(existing.families.map((f) => [f.id, f.name]));

  let skippedStudents = 0;
  const families: PlannedFamily[] = [];

  for (const groupRows of groups.values()) {
    const emails = [...new Set(groupRows.flatMap((r) => r.emails))];
    const identifiers = [...new Set(groupRows.map((r) => r.familyIdentifier).filter(Boolean))];
    const owners = new Set(emails.map((e) => emailOwner.get(e)).filter((x): x is string => Boolean(x)));
    for (const id of identifiers) {
      const match = familyByName.get(nameKey(id));
      if (match) owners.add(match);
    }
    if (owners.size > 1) {
      errors.push({
        line: groupRows[0].line,
        message: `Los correos o identificadores (${[...emails, ...identifiers].join(', ')}) ya pertenecen a familias distintas. Revísalo manualmente.`,
      });
      continue;
    }
    if (identifiers.length > 1) {
      errors.push({
        line: groupRows[0].line,
        message: `El correo ${emails.join(', ')} aparece con identificadores de familia distintos: ${identifiers.join(', ')}.`,
      });
      continue;
    }

    const existingId = owners.size === 1 ? [...owners][0] : null;
    const name = existingId ? familyName.get(existingId) ?? identifiers[0] ?? emails[0] : identifiers[0] ?? `Familia ${emails[0]}`;
    const existingStudents = new Set(
      existing.students.filter((s) => s.familyId === existingId).map((s) => nameKey(s.name)),
    );
    const newStudents: string[] = [];
    for (const r of groupRows) {
      const key = nameKey(r.studentName);
      if (existingStudents.has(key)) {
        skippedStudents++;
        continue;
      }
      existingStudents.add(key);
      newStudents.push(r.studentName);
    }
    const newEmails = emails.filter((e) => !emailOwner.has(e));
    if (!existingId || newEmails.length || newStudents.length) {
      families.push({ existingId, name, newEmails, newStudents });
    }
  }

  return { families, errors, skippedStudents };
}
