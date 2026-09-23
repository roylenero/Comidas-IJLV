/** Nombres de colecciones y documentos, centralizados. */
export const COL = {
  admins: 'admins',
  authorizedEmails: 'authorizedEmails',
  families: 'families',
  students: 'students',
  settings: 'settings',
  menuWeeks: 'menuWeeks',
  menuDays: 'menuDays',
  menuAssets: 'menuAssets',
  orders: 'orders',
} as const;

export const SETTINGS_DOC_ID = 'app';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
