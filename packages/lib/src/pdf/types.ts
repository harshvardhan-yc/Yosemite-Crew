export type ClinicalDocumentType = 'DISCHARGE_SUMMARY' | 'SOAP_NOTE' | 'PRESCRIPTION' | 'INVOICE';

export type DocumentSignatureStatus = 'SIGNED' | 'PENDING';

export type OrganizationBranding = {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  logoPath?: string;
  legalName?: string;
  footerText?: string;
};

export type DocumentSignature = {
  status: DocumentSignatureStatus;
  signerName?: string;
  signerRole?: string;
  signerDegree?: string;
  signedAt?: Date | string;
  signatureImagePath?: string;
  label?: string;
};

export type BaseClinicalDocumentData = {
  title: string;
  printedBy?: string;
  signature?: DocumentSignature;
};

export type ClinicalDocumentDataByType = {
  DISCHARGE_SUMMARY: DischargeSummaryDocumentData;
  SOAP_NOTE: SoapNoteDocumentData;
  PRESCRIPTION: PrescriptionDocumentData;
  INVOICE: InvoiceDocumentData;
};

export type PdfGenerationInput<TData extends BaseClinicalDocumentData = BaseClinicalDocumentData> =
  {
    documentType: ClinicalDocumentType;
    organization: OrganizationBranding;
    data: TData;
  };

export type PdfTheme = {
  colors: {
    brand: string;
    brandDark: string;
    text: string;
    muted: string;
    border: string;
    panel: string;
    success: string;
  };
  fonts: {
    regular: string;
    bold: string;
    italic: string;
  };
  fontSizes: {
    title: number;
    sectionTitle: number;
    subtitle: number;
    body: number;
    small: number;
    tiny: number;
  };
  spacing: {
    pageMarginX: number;
    headerHeight: number;
    footerHeight: number;
    contentTopGap: number;
    contentBottomGap: number;
    sectionGap: number;
    paragraphGap: number;
    itemGap: number;
    tableCellPaddingX: number;
    tableCellPaddingY: number;
  };
};

export type DischargeSummaryDocumentData = BaseClinicalDocumentData & {
  date: Date | string;
  appointmentId: string;
  doctorName: string;
  patientName: string;
  speciesBreed: string;
  ageSex: string;
  clientName: string;
  clientId: string;
  contact: string;
  chiefComplaint: string;
  treatmentSummary: string;
  procedures: string[];
  diagnostics: string[];
  dischargeSummary: string;
  homeCare: string[];
  emergencyCare: string[];
  emergencyContact: string;
};

export type SoapNoteDocumentData = BaseClinicalDocumentData & {
  date: Date | string;
  appointmentId?: string;
  doctorName: string;
  patientName: string;
  speciesBreed?: string;
  ageSex?: string;
  clientName?: string;
  clientId?: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type PrescriptionItem = {
  medication: string;
  strength?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
};

export type PrescriptionDocumentData = BaseClinicalDocumentData & {
  date: Date | string;
  prescriptionId?: string;
  doctorName: string;
  patientName: string;
  speciesBreed?: string;
  ageSex?: string;
  clientName?: string;
  clientId?: string;
  items: PrescriptionItem[];
  notes?: string;
};

export type InvoiceItem = {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoiceDocumentData = BaseClinicalDocumentData & {
  invoiceNumber: string;
  date: Date | string;
  dueDate?: Date | string;
  clientName: string;
  clientId?: string;
  patientName?: string;
  doctorName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
  paymentNotes?: string;
};

export type KeyValueItem = {
  label: string;
  value: string;
};

export type TableColumn = {
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

export type TableRenderInput = {
  columns: TableColumn[];
  rows: string[][];
  rowHeight?: number;
  headerHeight?: number;
};

export type DocumentEndBlockInput = {
  printedBy?: string;
  signature?: DocumentSignature;
};

export type RenderHeaderInput = {
  organization: OrganizationBranding;
};

export type RenderFooterInput = {
  organization: OrganizationBranding;
  generatedAt?: Date;
};
