import type { PdfContext } from '../PdfContext.js';
import { renderBulletList } from './BulletList.js';
import { renderParagraph } from './Text.js';

const HTML_BLOCK_BREAKS = [
  /<\s*br\s*\/?\s*>/giu,
  /<\/\s*p\s*>/giu,
  /<\/\s*div\s*>/giu,
  /<\/\s*li\s*>/giu,
  /<\/\s*h[1-6]\s*>/giu,
];

const HTML_OPENING_BLOCKS = [
  /<\s*p[^>]*>/giu,
  /<\s*div[^>]*>/giu,
  /<\s*li[^>]*>/giu,
  /<\s*h[1-6][^>]*>/giu,
];

const decodeEntities = (value: string): string =>
  value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");

const hasHtml = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value);

const humanizeLabel = (value: string): string =>
  value
    .split(/[\s._/-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const htmlToPlainText = (value: string): string => {
  let output = value;

  for (const pattern of HTML_BLOCK_BREAKS) {
    output = output.replaceAll(pattern, '\n');
  }

  for (const pattern of HTML_OPENING_BLOCKS) {
    output = output.replaceAll(pattern, '');
  }

  output = output.replaceAll(/<\s*ul[^>]*>/giu, '\n');
  output = output.replaceAll(/<\s*ol[^>]*>/giu, '\n');
  output = output.replaceAll(/<\s*[^>]+>/giu, '');
  output = decodeEntities(output);
  output = output.replaceAll(/\n{3,}/gu, '\n\n');
  return output.trim();
};

const toStringValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toStringValue(item))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferredKeys = ['html', 'text', 'value', 'content', 'body', 'richText'];

    for (const key of preferredKeys) {
      const nested = record[key];
      if (nested !== undefined && nested !== null) {
        const nestedValue = toStringValue(nested);
        if (nestedValue.trim()) {
          return nestedValue;
        }
      }
    }

    const entries = Object.entries(record);
    if (!entries.length) {
      return '';
    }

    return entries
      .map(([key, item]) => {
        const nested = toStringValue(item);
        if (!nested) {
          return '';
        }

        return `${humanizeLabel(key)}: ${nested}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
};

export const renderRichText = (ctx: PdfContext, value: unknown): void => {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'runs' in (value as Record<string, unknown>) &&
    (value as { runs?: unknown }).runs !== undefined
  ) {
    const runsValue = (value as { runs: unknown }).runs;
    if (typeof runsValue === 'string') {
      renderParagraph(ctx, runsValue, { fontSize: ctx.theme.fontSizes.body });
      return;
    }

    if (Array.isArray(runsValue)) {
      const runs = runsValue as Array<{ text: string; bold?: boolean }>;
      renderParagraph(ctx, runs.map((run) => run.text).join(''), {
        fontSize: ctx.theme.fontSizes.body,
      });
      return;
    }
    return;
  }

  const raw = toStringValue(value).trim();

  if (!raw) {
    renderParagraph(ctx, '—', { fontSize: ctx.theme.fontSizes.body });
    return;
  }

  if (Array.isArray(value)) {
    renderBulletList(
      ctx,
      value.map((item) => toStringValue(item)).filter((item) => item.trim().length > 0)
    );
    return;
  }

  const plainText = hasHtml(raw) ? htmlToPlainText(raw) : raw;

  if (!plainText) {
    renderParagraph(ctx, '—', { fontSize: ctx.theme.fontSizes.body });
    return;
  }

  renderParagraph(ctx, plainText, {
    fontSize: ctx.theme.fontSizes.body,
  });
};
