import { BusinessOptions } from '@/app/features/organization/types/org';

type FieldType = 'text' | 'select' | 'country' | 'date' | 'number' | 'googleAddress';

export type ProfileField = {
  label: string;
  key: string;
  required: boolean;
  editable: boolean;
  type: FieldType;
  options?: { label: string; value: string }[];
};

export const field = (
  label: string,
  key: string,
  type: FieldType = 'text',
  editable: boolean = true,
  required: boolean = true,
  options?: { label: string; value: string }[]
): ProfileField => ({ label, key, type, editable, required, options });

export const BasicFields: ProfileField[] = [
  field('Organization type', 'type', 'select', false, true, BusinessOptions),
  field('Organization name', 'name', 'text', false),
  field('Tax ID', 'taxId'),
  field('Country', 'country', 'country'),
  field('DUNS number', 'DUNSNumber', 'text', true, false),
  field('Phone number', 'phoneNo'),
];

export const AddressFields: ProfileField[] = [
  field('Address line', 'addressLine', 'googleAddress'),
  field('State / Province', 'state'),
  field('City', 'city'),
  field('Postal code', 'postalCode'),
];

export const CheckInFields: ProfileField[] = [
  field(
    'Enable check-in this many minutes before start',
    'appointmentCheckInBufferMinutes',
    'number',
    true
  ),
  field('Maximum check-in distance (meters)', 'appointmentCheckInRadiusMeters', 'number', true),
];
