import type { ISODate, ServiceType } from '../types/models';

/**
 * Identificador determinista: un alumno solo puede tener un documento por fecha y servicio.
 * Las reglas de Firestore exigen este mismo formato, así que es imposible crear un duplicado
 * aunque dos dispositivos lo intenten al mismo tiempo.
 */
export function orderIdFor(date: ISODate, studentId: string, service: ServiceType): string {
  return `${date}_${studentId}_${service}`;
}
