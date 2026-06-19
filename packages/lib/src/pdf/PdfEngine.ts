import PDFDocument from 'pdfkit';
import { renderFooter } from './branding/Footer.js';
import { renderHeader } from './branding/Header.js';
import { PdfContext } from './PdfContext.js';
import type { PdfDocumentInstance } from './PdfContext.js';
import type {
  BaseClinicalDocumentData,
  ClinicalDocumentType,
  ClinicalPdfRenderResult,
  PdfGenerationInput,
  PdfTheme,
} from './types.js';
import { renderDischargeSummaryTemplate } from './templates/DischargeSummaryTemplate.js';
import { renderInvoiceTemplate } from './templates/InvoiceTemplate.js';
import { renderPrescriptionTemplate } from './templates/PrescriptionTemplate.js';
import { renderSoapNoteTemplate } from './templates/SoapNoteTemplate.js';

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

const createDocument = (): PdfDocumentInstance =>
  new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    bufferPages: true,
  }) as PdfDocumentInstance;

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
    document.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    document.on('error', reject);
  });

  return {
    promise,
    reject: (error: Error) => {
      rejectFn?.(error);
    },
  };
};

const renderDocumentByType = <TData extends BaseClinicalDocumentData>(
  ctx: PdfContext,
  documentType: ClinicalDocumentType,
  data: TData
): ClinicalPdfRenderResult['signaturePlacement'] => {
  switch (documentType) {
    case 'DISCHARGE_SUMMARY':
      return renderDischargeSummaryTemplate(ctx, data as never);
    case 'SOAP_NOTE':
      return renderSoapNoteTemplate(ctx, data as never);
    case 'PRESCRIPTION':
      return renderPrescriptionTemplate(ctx, data as never);
    case 'INVOICE':
      return renderInvoiceTemplate(ctx, data as never);
    default: {
      const exhaustiveCheck: never = documentType;
      throw new Error(`Unsupported clinical document type: ${exhaustiveCheck}`);
    }
  }
};

export const generateClinicalPdfWithMetadata = async <TData extends BaseClinicalDocumentData>(
  input: PdfGenerationInput<TData>
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
    const signaturePlacement = renderDocumentByType(ctx, input.documentType, input.data);

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

export const generateClinicalPdf = async <TData extends BaseClinicalDocumentData>(
  input: PdfGenerationInput<TData>
): Promise<Buffer> => (await generateClinicalPdfWithMetadata(input)).pdf;

export const createClinicalPdfContext = (
  document: PdfDocumentInstance,
  organization: PdfGenerationInput['organization']
): PdfContext =>
  new PdfContext({
    document,
    organization,
    theme: THEME,
  });

export const clinicalPdfTheme = THEME;
