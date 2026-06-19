import {
  fromInvoiceRequestDTO,
  Invoice,
  InvoiceItem,
  InvoiceResponseDTO,
  PaymentCollectionMethod,
} from '@yosemite-crew/types';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { getData, patchData, postData } from '@/app/services/axios';

export type InvoicePaymentCollectionMethod = 'PAYMENT_AT_CLINIC';

type FinanceEnvelope<T> = {
  data: T;
  meta?: unknown;
  error?: { code?: string; message?: string; details?: unknown } | null;
};

export type FinanceInvoiceLineItem = {
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

type CreateFinanceInvoiceInput = {
  appointmentId?: string;
  parentId?: string;
  patientId?: string;
  organisationId: string;
  paymentCollectionMethod?: PaymentCollectionMethod;
  items: FinanceInvoiceLineItem[];
  invoiceDiscount?: { type: 'FIXED_AMOUNT' | 'PERCENTAGE'; value: number };
  notes?: string;
};

type ManualPaymentInput = {
  provider?: 'MANUAL';
  settlementChannel: 'CASH' | 'CARD_PRESENT' | 'BANK_TRANSFER' | 'DEPOSIT';
  amount: number;
  currency: string;
  reference?: string;
  receivedAt?: string;
  notes?: string;
};

type ReadyForBillingInput = {
  organisationId: string;
  visitId?: string;
  notes?: string;
};

type PaymentSessionResponse = {
  paymentAttemptId: string;
  checkoutUrl?: string;
  providerPaymentIntentId?: string;
  providerCheckoutSessionId?: string;
};

const FINANCE_BASE_PATH = '/v1/finance';

const APPOINTMENT_ID_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id';

const normalizeReferenceTail = (value: unknown): string | undefined => {
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    raw = String(value);
  }
  const normalizedRaw = raw.trim();
  if (!normalizedRaw) return undefined;
  const withoutQuery = normalizedRaw.split(/[?#]/)[0];
  const tail = withoutQuery.split('/').findLast(Boolean)?.trim();
  return tail || undefined;
};

const unwrapFinanceData = <T>(value: T | FinanceEnvelope<T>): T => {
  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    ('meta' in value || 'error' in value)
  ) {
    const envelope = value as FinanceEnvelope<T>;
    if (envelope.error) {
      throw new Error(envelope.error.message || envelope.error.code || 'Finance request failed');
    }
    return envelope.data;
  }
  return value as T;
};

const normalizeFinanceInvoice = (invoice: any, fallbackOrganisationId?: string): Invoice => {
  if (invoice?.resourceType === 'Invoice') {
    return normalizeInvoiceForFrontend(invoice, fallbackOrganisationId);
  }

  const createdAt = invoice?.createdAt ? new Date(invoice.createdAt) : new Date();
  const updatedAt = invoice?.updatedAt ? new Date(invoice.updatedAt) : createdAt;
  const subtotal =
    typeof invoice?.subtotal === 'number'
      ? invoice.subtotal
      : Array.isArray(invoice?.items)
        ? invoice.items.reduce((sum: number, item: any) => sum + Number(item?.total ?? 0), 0)
        : Number(invoice?.totalAmount ?? 0);

  return {
    id: invoice?.id,
    parentId: invoice?.parentId,
    patientId: invoice?.patientId,
    companionId: invoice?.companionId,
    organisationId: invoice?.organisationId ?? fallbackOrganisationId,
    appointmentId: invoice?.appointmentId,
    items: Array.isArray(invoice?.items) ? invoice.items : [],
    subtotal,
    taxPercent: invoice?.taxPercent,
    totalAmount: Number(invoice?.totalAmount ?? subtotal),
    paymentCollectionMethod: invoice?.paymentCollectionMethod ?? 'PAYMENT_LINK',
    currency: invoice?.currency ?? 'usd',
    discountTotal: invoice?.discountTotal,
    taxTotal: invoice?.taxTotal,
    stripeChargeId: invoice?.stripeChargeId,
    stripeReceiptUrl: invoice?.stripeReceiptUrl,
    stripePaymentIntentId: invoice?.stripePaymentIntentId,
    stripePaymentLinkId: invoice?.stripePaymentLinkId,
    stripeInvoiceId: invoice?.stripeInvoiceId,
    stripeCustomerId: invoice?.stripeCustomerId,
    stripeCheckoutSessionId: invoice?.stripeCheckoutSessionId,
    stripeCheckoutUrl: invoice?.stripeCheckoutUrl,
    status: invoice?.status ?? 'PENDING',
    metadata: invoice?.metadata,
    paidAt: invoice?.paidAt ? new Date(invoice.paidAt) : undefined,
    createdAt,
    updatedAt,
  };
};

const getInvoiceAppointmentIdFallback = (fhirInvoice: InvoiceResponseDTO): string | undefined => {
  const invoice = fhirInvoice as any;
  const extensions = Array.isArray(invoice?.extension) ? invoice.extension : [];
  const appointmentIdFromExtension = extensions.find(
    (ext: any) => String(ext?.url ?? '') === APPOINTMENT_ID_EXTENSION_URL
  )?.valueString;
  const appointmentIdFromAccount = normalizeReferenceTail(invoice?.account?.reference);
  const appointmentIdFromRawField = normalizeReferenceTail(invoice?.appointmentId);

  return (
    normalizeReferenceTail(appointmentIdFromExtension) ??
    appointmentIdFromAccount ??
    appointmentIdFromRawField
  );
};

const normalizeInvoiceForFrontend = (
  fhirInvoice: InvoiceResponseDTO,
  fallbackOrganisationId?: string
) => {
  const parsedInvoice = fromInvoiceRequestDTO(fhirInvoice);
  const resolvedAppointmentId =
    String(parsedInvoice?.appointmentId ?? '').trim() ||
    getInvoiceAppointmentIdFallback(fhirInvoice);
  const resolvedOrganisationId =
    String(parsedInvoice?.organisationId ?? '').trim() || fallbackOrganisationId;

  return {
    ...parsedInvoice,
    appointmentId: resolvedAppointmentId || parsedInvoice.appointmentId,
    organisationId: resolvedOrganisationId || parsedInvoice.organisationId,
  };
};

export const loadInvoicesForOrgPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, invoiceIdsByOrgId, setInvoicesForOrg } = useInvoiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load specialities.');
    return;
  }
  const hasOrgData = !invoiceIdsByOrgId || Object.hasOwn(invoiceIdsByOrgId, primaryOrgId);
  if (!shouldFetchInvoices(status, hasOrgData, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<FinanceEnvelope<unknown[]> | unknown[]>(
      `${FINANCE_BASE_PATH}/invoices`,
      {
        organisationId: primaryOrgId,
      }
    );
    const invoicePayload = unwrapFinanceData(res.data) ?? [];
    const invoices = invoicePayload.map((invoice) =>
      normalizeFinanceInvoice(invoice, primaryOrgId)
    );
    setInvoicesForOrg(primaryOrgId, invoices);
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const loadInvoicesForAppointment = async (appointmentId: string): Promise<void> => {
  const { upsertInvoice } = useInvoiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load appointment invoices.');
    return;
  }
  if (!appointmentId) {
    console.warn('No appointment id provided. Cannot load appointment invoices.');
    return;
  }

  try {
    const res = await getData<FinanceEnvelope<unknown[]> | unknown[]>(
      `${FINANCE_BASE_PATH}/invoices`,
      {
        organisationId: primaryOrgId,
        appointmentId,
      }
    );
    const invoicePayload = unwrapFinanceData(res.data) ?? [];
    const invoices = invoicePayload.map((invoice) =>
      normalizeFinanceInvoice(invoice, primaryOrgId)
    );
    invoices.forEach((invoice) => {
      upsertInvoice(invoice);
    });
  } catch (err) {
    console.error('Failed to load appointment invoices:', err);
    throw err;
  }
};

const shouldFetchInvoices = (
  status: ReturnType<typeof useInvoiceStore.getState>['status'],
  hasOrgData: boolean,
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  if (!hasOrgData) return true;
  return status === 'idle' || status === 'error';
};

export const addLineItemsToAppointments = async (
  lineItems: InvoiceItem[],
  appointmentId: string,
  currency: string
): Promise<void> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot add.');
    return;
  }
  try {
    if (!appointmentId || lineItems.length <= 0 || !currency) {
      throw new Error('Line items or Appointment ID or Currency missing');
    }
    const invoice = await ensureAppointmentInvoice(appointmentId);
    const body = {
      items: lineItems.map((item) => ({
        name: item.name,
        description: item.description ?? item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      currency: currency.toLowerCase(),
    };
    await postData<FinanceEnvelope<unknown> | unknown>(
      `${FINANCE_BASE_PATH}/invoices/${invoice.id}/lines`,
      body
    );
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const getPaymentLink = async (invoiceId: string): Promise<string | undefined> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot get.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    const res = await postData<FinanceEnvelope<PaymentSessionResponse> | PaymentSessionResponse>(
      `${FINANCE_BASE_PATH}/invoices/${invoiceId}/payments/sessions`,
      { provider: 'STRIPE' }
    );
    const paymentSession = unwrapFinanceData(res.data);
    const url = paymentSession.checkoutUrl;
    if (!url) throw new Error('No checkout URL returned from backend.');
    return url;
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const markInvoicePaid = async (invoiceId: string) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot mark paid.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    const invoice = await getFinanceInvoiceById(invoiceId);
    return await recordManualInvoicePayment(invoiceId, {
      provider: 'MANUAL',
      settlementChannel: 'CASH',
      amount: invoice.totalAmount,
      currency: invoice.currency,
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to mark invoice paid:', err);
    throw err;
  }
};

export const updateInvoicePaymentCollectionMethod = async (
  invoiceId: string,
  paymentCollectionMethod: InvoicePaymentCollectionMethod
) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot update payment collection method.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    return await patchData(`${FINANCE_BASE_PATH}/invoices/${invoiceId}/payment-collection-method`, {
      paymentCollectionMethod,
    });
  } catch (err) {
    console.error('Failed to update invoice payment collection method:', err);
    throw err;
  }
};

export const createFinanceInvoice = async (input: CreateFinanceInvoiceInput): Promise<Invoice> => {
  const res = await postData<FinanceEnvelope<unknown> | unknown>(`${FINANCE_BASE_PATH}/invoices`, {
    paymentCollectionMethod: 'PAYMENT_LINK',
    ...input,
  });
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), input.organisationId);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const getFinanceInvoiceById = async (invoiceId: string): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const res = await getData<FinanceEnvelope<unknown> | unknown>(
    `${FINANCE_BASE_PATH}/invoices/${invoiceId}`
  );
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const finalizeFinanceInvoice = async (invoiceId: string): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const res = await postData<FinanceEnvelope<unknown> | unknown>(
    `${FINANCE_BASE_PATH}/invoices/${invoiceId}/finalize`,
    { taxProvider: 'STRIPE' }
  );
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const recordManualInvoicePayment = async (
  invoiceId: string,
  input: ManualPaymentInput
): Promise<unknown> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  const res = await postData<FinanceEnvelope<unknown> | unknown>(
    `${FINANCE_BASE_PATH}/invoices/${invoiceId}/payments`,
    {
      provider: 'MANUAL',
      ...input,
    }
  );
  return unwrapFinanceData(res.data);
};

export const createSupplementalInvoice = async (
  invoiceId: string,
  items: FinanceInvoiceLineItem[]
): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  if (!items.length) throw new Error('At least one line item is required');
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const res = await postData<FinanceEnvelope<unknown> | unknown>(
    `${FINANCE_BASE_PATH}/invoices/${invoiceId}/supplement`,
    { items }
  );
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const markAppointmentReadyForBilling = async (
  appointmentId: string,
  input: ReadyForBillingInput
): Promise<unknown> => {
  if (!appointmentId) throw new Error('Appointment ID missing');
  const res = await postData<FinanceEnvelope<unknown> | unknown>(
    `${FINANCE_BASE_PATH}/appointments/${appointmentId}/ready-for-billing`,
    input
  );
  return unwrapFinanceData(res.data);
};

export const seedAppointmentInvoice = async (appointmentId: string): Promise<Invoice> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const state = useInvoiceStore.getState();
  if (primaryOrgId) {
    const existing = state
      .getInvoicesByOrgId(primaryOrgId)
      .find((invoice) => invoice.appointmentId === appointmentId && invoice.status !== 'CANCELLED');
    if (existing?.id) return existing;
  }

  const res = await postData<FinanceEnvelope<unknown> | unknown>(
    `${FINANCE_BASE_PATH}/mobile/appointments/${appointmentId}/seed`,
    {}
  );
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

const ensureAppointmentInvoice = seedAppointmentInvoice;
