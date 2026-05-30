import { InvoiceItem, Service } from '@yosemite-crew/types';
import { SoapNoteSubmission } from '@/app/features/appointments/types/soap';

export type ServiceEdit = Service & {
  discount: string;
};

export type FormDataProps = {
  subjective: SoapNoteSubmission[];
  objective: SoapNoteSubmission[];
  assessment: SoapNoteSubmission[];
  discharge: SoapNoteSubmission[];
  plan: SoapNoteSubmission[];
  total: string;
  subTotal: string;
  tax: string;
  discount: string;
  lineItems: InvoiceItem[];
};

export const createEmptyFormData = (): FormDataProps => ({
  subjective: [],
  objective: [],
  assessment: [],
  discharge: [],
  plan: [],
  total: '',
  discount: '',
  subTotal: '',
  tax: '',
  lineItems: [],
});
