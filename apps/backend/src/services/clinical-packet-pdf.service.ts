// We merge unsigned PDFs here and let the Documenso server apply the
// cryptographic signature, so pdf-lib is sufficient. We evaluated @libpdf/core
// (Documenso's own library), but as of v0.4.0 it ships ESM-only with .d.mts
// types that don't resolve under this backend's `moduleResolution: "node"`
// (it degrades to `any` and fails strict lint). Revisit it once it leaves beta
// or if we move to local/post-signature PDF processing, where its
// signature-preserving incremental saves would actually be needed.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ClinicalPdfSignaturePlacement } from "@yosemite-crew/lib";
import { getPersistedRenderedDocumentPdf } from "src/services/rendered-document.service";

/**
 * A single document to be bundled into the merged clinical packet.
 */
export type MergedPacketDocument = {
  documentId: string;
  title: string;
  kind: string;
};

export type MergedClinicalPacketPdf = {
  pdf: Buffer;
  pageCount: number;
  signaturePlacement: ClinicalPdfSignaturePlacement;
};

export class ClinicalPacketPdfError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "ClinicalPacketPdfError";
    this.statusCode = statusCode;
  }
}

/**
 * Loader for an individual document's PDF bytes. Injected for testability;
 * defaults to the persisted rendered-document pipeline.
 */
export type PacketDocumentPdfLoader = (
  documentId: string,
  organisationId: string,
) => Promise<Buffer>;

const defaultDocumentPdfLoader: PacketDocumentPdfLoader = async (
  documentId,
  organisationId,
) => {
  const result = await getPersistedRenderedDocumentPdf(
    documentId,
    organisationId,
  );
  return result.pdf;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Documenso positions signature fields from the top-left of the page. Keep the
// width/height consistent with the single-document default so the rendered
// signature box and the Documenso field line up.
const SIGNATURE_FIELD = {
  pageX: 80,
  pageY: 690,
  width: 240,
  height: 96,
};

const humanizeKind = (kind: string): string =>
  kind
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const drawAttestationPage = (
  merged: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  input: {
    title: string;
    documents: MergedPacketDocument[];
    signerName?: string | null;
  },
): void => {
  const page = merged.addPage([A4_WIDTH, A4_HEIGHT]);
  const left = 72;
  let cursorY = A4_HEIGHT - 80;

  page.drawText("Clinical Document Packet", {
    x: left,
    y: cursorY,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 28;

  page.drawText(input.title, {
    x: left,
    y: cursorY,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  cursorY -= 30;

  page.drawText("This packet contains the following documents:", {
    x: left,
    y: cursorY,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 22;

  input.documents.forEach((doc, index) => {
    page.drawText(`${index + 1}. ${doc.title}  (${humanizeKind(doc.kind)})`, {
      x: left + 12,
      y: cursorY,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursorY -= 18;
  });

  cursorY -= 24;
  const attestation =
    "By signing below I confirm that I have reviewed the documents listed " +
    "above and that they form a single, complete clinical record.";
  page.drawText(attestation, {
    x: left,
    y: cursorY,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: A4_WIDTH - left * 2,
    lineHeight: 14,
  });

  // Signature box (bottom-left origin in pdf-lib; convert from Documenso's
  // top-left field coordinates).
  const boxBottom =
    A4_HEIGHT - (SIGNATURE_FIELD.pageY + SIGNATURE_FIELD.height);
  page.drawRectangle({
    x: SIGNATURE_FIELD.pageX,
    y: boxBottom,
    width: SIGNATURE_FIELD.width,
    height: SIGNATURE_FIELD.height,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
  });
  page.drawText("Signature", {
    x: SIGNATURE_FIELD.pageX,
    y: boxBottom - 14,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  if (input.signerName) {
    page.drawText(input.signerName, {
      x: SIGNATURE_FIELD.pageX,
      y: boxBottom - 28,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
};

/**
 * Merge the per-document PDFs of a packet into a single PDF and append one
 * attestation/signature page. The returned signature placement targets that
 * appended page so a single signer signs the whole packet once.
 */
export const buildMergedClinicalPacketPdf = async (
  input: {
    organisationId: string;
    title: string;
    documents: MergedPacketDocument[];
    signerName?: string | null;
  },
  loadDocumentPdf: PacketDocumentPdfLoader = defaultDocumentPdfLoader,
): Promise<MergedClinicalPacketPdf> => {
  if (!input.documents.length) {
    throw new ClinicalPacketPdfError(
      "Cannot build a packet with no documents",
      409,
    );
  }

  const merged = await PDFDocument.create();

  for (const doc of input.documents) {
    let source: PDFDocument;
    try {
      const bytes = await loadDocumentPdf(doc.documentId, input.organisationId);
      source = await PDFDocument.load(bytes);
    } catch (error) {
      throw new ClinicalPacketPdfError(
        `Unable to load PDF for document ${doc.documentId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        502,
      );
    }

    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }

  const font = await merged.embedFont(StandardFonts.Helvetica);
  const boldFont = await merged.embedFont(StandardFonts.HelveticaBold);
  drawAttestationPage(merged, font, boldFont, input);

  const pdfBytes = await merged.save();
  const pageCount = merged.getPageCount();

  return {
    pdf: Buffer.from(pdfBytes),
    pageCount,
    signaturePlacement: {
      pageNumber: pageCount,
      pageX: SIGNATURE_FIELD.pageX,
      pageY: SIGNATURE_FIELD.pageY,
      width: SIGNATURE_FIELD.width,
      height: SIGNATURE_FIELD.height,
    },
  };
};
