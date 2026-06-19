import PDFDocument from 'pdfkit';
import { renderFooter } from './branding/Footer.js';
import { renderHeader } from './branding/Header.js';
import { PdfContext } from './PdfContext.js';
import type { PdfDocumentInstance } from './PdfContext.js';
import { ensureSpace } from './Pagination.js';
import { renderDocumentEndBlock } from './sections/DocumentEndBlock.js';
import { renderBulletList } from './sections/BulletList.js';
import {
  renderDocumentTitle,
  renderParagraph,
  renderSectionTitle,
  renderSpacer,
  renderSubTitle,
} from './sections/Text.js';
import { renderTable } from './sections/Table.js';
import type {
  ClinicalPdfRenderResult,
  DocumentSignature,
  OrganizationBranding,
  PdfTheme,
} from './types.js';

type TemplateFieldDefinitionLike = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  repeatable?: boolean;
  section?: string;
  order?: number;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  rules?: Record<string, unknown>;
  visibilityConditions?: Record<string, unknown>;
  source?: string;
  [key: string]: unknown;
};

type TemplateSectionLike = {
  id: string;
  title: string;
  description?: string;
  order?: number;
  fields: TemplateFieldDefinitionLike[];
  [key: string]: unknown;
};

type ResolvedTemplateLike = {
  templateId?: string;
  templateVersion?: number;
  templateVersionId?: string;
  source?: string;
  ownerUserId?: string | null;
  kind?: string;
  name: string;
  reason?: string;
  schemaSnapshot: {
    sections: TemplateSectionLike[];
  };
  renderConfigSnapshot?: Record<string, unknown> | null;
  validationSnapshot?: Record<string, unknown> | null;
  appliesTo?: unknown;
  [key: string]: unknown;
};

type ResolvedTemplatePdfInput = {
  organization: OrganizationBranding;
  template: ResolvedTemplateLike;
  data: Record<string, unknown>;
  title?: string;
  printedBy?: string;
  signature?: DocumentSignature;
};

const createDocument = (): PdfDocumentInstance =>
  new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    bufferPages: true,
  }) as PdfDocumentInstance;

const THEME: PdfTheme = {
  colors: {
    brand: '#0F766E',
    brandDark: '#134E4A',
    text: '#1F2937',
    muted: '#6B7280',
    border: '#D1D5DB',
    panel: '#F9FAFB',
    success: '#16A34A',
  },
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
  },
  fontSizes: {
    title: 18,
    sectionTitle: 11.5,
    subtitle: 10,
    body: 10.5,
    small: 9,
    tiny: 7.5,
  },
  spacing: {
    pageMarginX: 42,
    headerHeight: 92,
    footerHeight: 66,
    contentTopGap: 14,
    contentBottomGap: 16,
    sectionGap: 10,
    paragraphGap: 8,
    itemGap: 8,
    tableCellPaddingX: 8,
    tableCellPaddingY: 7,
  },
};

const collectPdfBuffer = (
  document: PdfDocumentInstance
): {
  promise: Promise<Buffer>;
  reject: (error: Error) => void;
} => {
  const chunks: Buffer[] = [];
  let rejectFn: ((error: Error) => void) | undefined;

  const promise = new Promise<Buffer>((resolve, reject) => {
    rejectFn = reject;

    document.on('data', (chunk: Buffer | Uint8Array | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  return {
    promise,
    reject: (error: Error) => {
      rejectFn?.(error);
    },
  };
};

const normalizeText = (value: unknown): string => {
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
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const commonKeys = ['signerName', 'signerRole', 'signerDegree', 'value', 'label', 'text'];
    const nested = commonKeys
      .map((key) => record[key])
      .map((item) => normalizeText(item))
      .filter(Boolean);

    if (nested.length > 0) {
      return nested.join(' ');
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return '';
};

const toDateString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return normalizeText(value);
};

const isObjectArray = (value: unknown): value is Array<Record<string, unknown>> =>
  Array.isArray(value) &&
  value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));

const buildTableColumns = (
  field: TemplateFieldDefinitionLike,
  rows: Array<Record<string, unknown>>
): Array<{ header: string; width?: number }> => {
  const configuredColumns = field.rules?.['columns'];

  if (
    Array.isArray(configuredColumns) &&
    configuredColumns.every((column) => typeof column === 'string')
  ) {
    return configuredColumns.map((column) => ({ header: column }));
  }

  const keys = rows[0] ? Object.keys(rows[0]) : [];
  return keys.map((key) => ({ header: key }));
};

const buildTableRows = (
  columns: Array<{ header: string }>,
  rows: Array<Record<string, unknown>>
): string[][] =>
  rows.map((row) =>
    columns.map((column) => normalizeText(row[column.header] ?? row[column.header.toLowerCase()]))
  );

const renderTemplateFieldValue = (
  ctx: PdfContext,
  field: TemplateFieldDefinitionLike,
  value: unknown
): void => {
  if (value === undefined || value === null || value === '') {
    renderParagraph(ctx, '—', { fontSize: ctx.theme.fontSizes.body });
    return;
  }

  switch (field.type) {
    case 'date':
    case 'datetime':
      renderParagraph(ctx, toDateString(value), { fontSize: ctx.theme.fontSizes.body });
      return;
    case 'boolean':
      renderParagraph(ctx, value === true ? 'Yes' : 'No', {
        fontSize: ctx.theme.fontSizes.body,
      });
      return;
    case 'multiSelect':
      if (Array.isArray(value)) {
        renderBulletList(ctx, value.map((item) => normalizeText(item)).filter(Boolean));
        return;
      }
      break;
    case 'table':
    case 'repeater':
    case 'vitalRow':
    case 'medicationLine':
      if (isObjectArray(value)) {
        const columns = buildTableColumns(field, value);
        renderTable(ctx, {
          columns,
          rows: buildTableRows(columns, value),
        });
        return;
      }
      if (Array.isArray(value)) {
        renderBulletList(ctx, value.map((item) => normalizeText(item)).filter(Boolean));
        return;
      }
      break;
    case 'signature':
      renderParagraph(ctx, 'Signed electronically', { fontSize: ctx.theme.fontSizes.body });
      return;
    case 'richText':
    case 'textarea':
    case 'instructionBlock':
    case 'assessmentItem':
    case 'planItem':
      if (Array.isArray(value)) {
        renderBulletList(ctx, value.map((item) => normalizeText(item)).filter(Boolean));
        return;
      }
      renderParagraph(ctx, normalizeText(value), { fontSize: ctx.theme.fontSizes.body });
      return;
    default:
      break;
  }

  renderParagraph(ctx, normalizeText(value), { fontSize: ctx.theme.fontSizes.body });
};

const renderTemplateSection = (
  ctx: PdfContext,
  section: TemplateSectionLike,
  data: Record<string, unknown>
): void => {
  renderSectionTitle(ctx, section.title);
  if (section.description) {
    renderParagraph(ctx, section.description, {
      fontSize: ctx.theme.fontSizes.small,
      color: ctx.theme.colors.muted,
    });
    renderSpacer(ctx, 4);
  }

  const fields = [...section.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const field of fields) {
    ensureSpace(ctx, 36);
    renderSubTitle(ctx, field.label);
    renderTemplateFieldValue(ctx, field, data[field.key]);
    renderSpacer(ctx, 6);
  }
};

const renderResolvedTemplateBody = (
  ctx: PdfContext,
  input: ResolvedTemplatePdfInput
): ClinicalPdfRenderResult['signaturePlacement'] => {
  const sections = [...input.template.schemaSnapshot.sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  renderDocumentTitle(ctx, input.title ?? input.template.name);
  if (input.template.reason) {
    renderParagraph(ctx, input.template.reason, {
      fontSize: ctx.theme.fontSizes.small,
      color: ctx.theme.colors.muted,
    });
    renderSpacer(ctx, 6);
  }

  for (const section of sections) {
    renderTemplateSection(ctx, section, input.data);
  }

  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  return renderDocumentEndBlock(ctx, {
    printedBy: input.printedBy,
    signature: input.signature,
  });
};

export const generateResolvedTemplatePdfWithMetadata = async (
  input: ResolvedTemplatePdfInput
): Promise<ClinicalPdfRenderResult> => {
  const document = createDocument();
  const ctx = new PdfContext({
    document,
    organization: input.organization,
    theme: THEME,
  });
  const output = collectPdfBuffer(document);

  try {
    await renderHeader(ctx);
    const signaturePlacement = renderResolvedTemplateBody(ctx, input);

    const pageRange = document.bufferedPageRange();
    for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
      document.switchToPage(index);
      renderFooter(ctx, index + 1, pageRange.count, ctx.generatedAt);
    }

    document.end();
    const pdf = await output.promise;

    return {
      pdf,
      pageCount: pageRange.count,
      signaturePlacement,
    };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    output.reject(normalizedError);
    throw normalizedError;
  }
};

export const generateResolvedTemplatePdf = async (
  input: ResolvedTemplatePdfInput
): Promise<Buffer> => (await generateResolvedTemplatePdfWithMetadata(input)).pdf;

export type { ResolvedTemplatePdfInput };
