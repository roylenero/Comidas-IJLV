import { CURRENCY, LOCALE } from '../config/business';

const formatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "$55" / "$55.50" */
export function formatMoney(amount: number): string {
  return formatter.format(amount);
}
