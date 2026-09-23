import { describe, expect, it } from 'vitest';
import { planImport, readImportCsv } from './importPlan';

const empty = { families: [], students: [], emails: [] };

describe('importación CSV', () => {
  it('agrupa hermanos que comparten correo en la misma familia', () => {
    const csv = [
      'studentName,parentEmail,familyIdentifier',
      'Mateo Demo,papa.demo@ejemplo.com,Familia Demo 1',
      'Sofía Demo,PAPA.DEMO@ejemplo.com,',
      'Lucía Demo,otra@ejemplo.com,Familia Demo 2',
    ].join('\n');
    const { rows, errors } = readImportCsv(csv);
    expect(errors).toEqual([]);
    const plan = planImport(rows, empty);
    expect(plan.errors).toEqual([]);
    expect(plan.families).toHaveLength(2);
    const f1 = plan.families.find((f) => f.name === 'Familia Demo 1')!;
    expect(f1.newStudents).toEqual(['Mateo Demo', 'Sofía Demo']);
    expect(f1.newEmails).toEqual(['papa.demo@ejemplo.com']);
  });

  it('acepta separador ; y encabezados en español, y varios correos por familia', () => {
    const csv = 'alumno;correo;familia\n"Pérez, Ana Demo";mama@ejemplo.com|papa@ejemplo.com;Pérez Demo\n';
    const { rows } = readImportCsv(csv);
    const plan = planImport(rows, empty);
    expect(plan.families[0].newEmails).toEqual(['mama@ejemplo.com', 'papa@ejemplo.com']);
    expect(plan.families[0].newStudents).toEqual(['Pérez, Ana Demo']);
  });

  it('reutiliza familias existentes y no duplica alumnos', () => {
    const { rows } = readImportCsv('studentName,parentEmail,familyIdentifier\nMateo Demo,papa@ejemplo.com,X\nNuevo Demo,papa@ejemplo.com,X');
    const plan = planImport(rows, {
      families: [{ id: 'fam1', name: 'Familia Demo 1' }],
      students: [{ familyId: 'fam1', name: 'mateo  demo' }],
      emails: [{ email: 'papa@ejemplo.com', familyId: 'fam1' }],
    });
    expect(plan.families).toEqual([{ existingId: 'fam1', name: 'Familia Demo 1', newEmails: [], newStudents: ['Nuevo Demo'] }]);
    expect(plan.skippedStudents).toBe(1);
  });

  it('reporta errores de filas incompletas o correos inválidos', () => {
    const { rows, errors } = readImportCsv('studentName,parentEmail\n,papa@ejemplo.com\nAna Demo,no-es-correo');
    expect(rows).toHaveLength(0);
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it('detecta un correo con dos identificadores de familia distintos', () => {
    const { rows } = readImportCsv('studentName,parentEmail,familyIdentifier\nA Demo,x@ejemplo.com,F1\nB Demo,x@ejemplo.com,F2');
    const plan = planImport(rows, empty);
    expect(plan.errors).toHaveLength(1);
    expect(plan.families).toHaveLength(0);
  });
});
