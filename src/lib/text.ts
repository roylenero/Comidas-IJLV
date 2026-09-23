/** Coincidencia sin acentos ni mayúsculas. */
export function matches(text: string, query: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return norm(text).includes(norm(query.trim()));
}
