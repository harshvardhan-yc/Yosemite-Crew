import type { KeyValueItem } from '../types.js';

export const buildKeyValue = (
  entries: Array<[string, string | undefined | null]>
): KeyValueItem[] =>
  entries
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => ({
      label,
      value: String(value),
    }));

export const formatMoney = (currency: string, value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatDateValue = (value: Date): string => value.toISOString().slice(0, 10);
