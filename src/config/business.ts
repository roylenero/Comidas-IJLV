/**
 * Datos institucionales y reglas de negocio fijas.
 * Los PRECIOS no viven aquí: son editables por administración y se leen de Firestore (settings/app).
 */

export const APP_NAME = 'Instituto Juan Luis Vives — Comidas';
export const APP_SHORT_NAME = 'IJLV Comidas';
export const INSTITUTION_NAME = 'Instituto Juan Luis Vives';

export const TIMEZONE = 'America/Mexico_City';
export const LOCALE = 'es-MX';
export const CURRENCY = 'MXN';

/** Teléfono para pedidos fuera de horario. */
export const CONTACT_PHONE = {
  display: '222 914 4408',
  tel: '+522229144408',
} as const;

export const SERVICE_TYPES = ['breakfast', 'lunch'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_LABELS: Record<ServiceType, { singular: string; plural: string; lower: string }> = {
  breakfast: { singular: 'Desayuno', plural: 'Desayunos', lower: 'desayuno' },
  lunch: { singular: 'Comida', plural: 'Comidas', lower: 'comida' },
};

/**
 * Hora local (America/Mexico_City) a partir de la cual los padres ya no pueden
 * crear, cancelar ni volver a solicitar el servicio del día. A las 10:00:00 ya está cerrado.
 * Al guardar un día del menú se calcula y almacena `cutoffAt` con estos valores;
 * las reglas de Firestore comparan ese instante contra la hora del servidor.
 */
export const SERVICE_CUTOFFS: Record<ServiceType, { hour: number; minute: number }> = {
  breakfast: { hour: 10, minute: 0 },
  lunch: { hour: 11, minute: 0 },
};

/** Precios sugeridos solo para crear settings/app la primera vez. */
export const DEFAULT_PRICES: Record<ServiceType, number> = {
  breakfast: 55,
  lunch: 70,
};

/** Límite duro de la imagen del menú guardada en Firestore (Data URL). */
export const MENU_IMAGE_LIMITS = {
  maxDimension: 1600,
  minDimension: 900,
  maxDataUrlBytes: 600 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

/** Tiempo máximo que esperamos la confirmación del servidor antes de avisar al usuario. */
export const SERVER_CONFIRM_TIMEOUT_MS = 15000;
