import PDFDocument from 'pdfkit';
import type { OrganizationBranding, PdfTheme } from './types.js';

export type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

export type PdfMargins = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type PdfContextConfig = {
  document: PdfDocumentInstance;
  organization: OrganizationBranding;
  theme: PdfTheme;
  margins?: Partial<PdfMargins>;
  headerHeight?: number;
  footerHeight?: number;
  generatedAt?: Date;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

export class PdfContext {
  public readonly document: PdfDocumentInstance;
  public readonly organization: OrganizationBranding;
  public readonly theme: PdfTheme;
  public readonly pageWidth: number;
  public readonly pageHeight: number;
  public readonly margins: PdfMargins;
  public readonly headerHeight: number;
  public readonly footerHeight: number;
  public readonly generatedAt: Date;
  public cursorY: number;

  constructor(config: PdfContextConfig) {
    this.document = config.document;
    this.organization = config.organization;
    this.theme = config.theme;
    this.pageWidth = this.document.page?.width ?? A4_WIDTH;
    this.pageHeight = this.document.page?.height ?? A4_HEIGHT;
    this.margins = {
      left: config.margins?.left ?? this.theme.spacing.pageMarginX,
      right: config.margins?.right ?? this.theme.spacing.pageMarginX,
      top: config.margins?.top ?? 0,
      bottom: config.margins?.bottom ?? 0,
    };
    this.headerHeight = config.headerHeight ?? this.theme.spacing.headerHeight;
    this.footerHeight = config.footerHeight ?? this.theme.spacing.footerHeight;
    this.generatedAt = config.generatedAt ?? new Date();
    this.cursorY = this.contentTop;
  }

  get contentLeft(): number {
    return this.margins.left;
  }

  get contentRight(): number {
    return this.pageWidth - this.margins.right;
  }

  get contentWidth(): number {
    return this.contentRight - this.contentLeft;
  }

  get contentTop(): number {
    return this.margins.top + this.headerHeight + this.theme.spacing.contentTopGap;
  }

  get contentBottom(): number {
    return (
      this.pageHeight -
      this.footerHeight -
      this.margins.bottom -
      this.theme.spacing.contentBottomGap
    );
  }

  moveDown(points: number): void {
    this.cursorY = Math.min(this.contentBottom, this.cursorY + points);
  }

  resetCursorForNewPage(): void {
    this.cursorY = this.contentTop;
  }
}
