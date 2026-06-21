import React from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { BusinessType } from '@/app/features/organization/types/org';
import { RiUploadCloud2Fill } from 'react-icons/ri';

import {
  InventoryItem,
  InventoryErrors,
  getSubCategoryOptions,
} from '@/app/features/inventory/pages/Inventory/types';
import {
  InventoryFormConfig,
  ConfigItem,
  FieldDef,
  InventorySectionKey,
} from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import {
  formatCurrencyValue,
  formatPercentValue,
  getAvailableStock,
  getGrossProfitPerUnit,
  getMarginPercent,
  getStockValue,
  toNumberSafe,
} from '@/app/features/inventory/pages/Inventory/utils';

const parseDate = (value?: string): Date | null => {
  if (!value) return null;

  if (value.includes('/')) {
    const [dd, mm, yyyy] = value.split('/');
    const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

type FormSectionProps = {
  businessType: BusinessType;
  sectionKey: InventorySectionKey;
  sectionTitle: string;
  formData: InventoryItem;
  errors: InventoryErrors;
  onFieldChange: (
    section: InventorySectionKey,
    name: string,
    value: string | string[],
    index?: number
  ) => void;
  onSave?: () => void;
  saveLabel?: string;
  disableSave?: boolean;
  onClear?: () => void;
  onAddBatch?: () => void;
  onRemoveBatch?: (index: number) => void;
  stockLocationOptions?: string[];
  headerSlot?: React.ReactNode;
};

const PricingSummary = ({ formData }: { formData: InventoryItem }) => (
  <div className="flex flex-col gap-2 px-4 text-body-4 text-text-primary">
    <div>
      <span>Gross profit per unit : </span>
      <span className="rounded-full bg-badge-blue-bg px-2 font-semibold text-badge-blue-text">
        {formatCurrencyValue(getGrossProfitPerUnit(formData), formData.currency)}
      </span>
    </div>
    <div>
      <span>Margin : </span>
      <span className="rounded-full bg-badge-blue-bg px-2 font-semibold text-badge-blue-text">
        {formatPercentValue(getMarginPercent(formData))}
      </span>
    </div>
    <FormInput
      intype="text"
      inname="stockValue"
      value={formatCurrencyValue(getStockValue(formData), formData.currency)}
      inlabel="Total stock value"
      readonly
    />
  </div>
);

const drugOnlyClassificationFields = new Set([
  'drugSchedule',
  'form',
  'administration',
  'strength',
  'unitofMeasure',
  'controlledSubstance',
  'prescriptionRequired',
  'reportableToGovernment',
]);

const FormSection: React.FC<FormSectionProps> = ({
  businessType,
  sectionKey,
  sectionTitle,
  formData,
  errors,
  onFieldChange,
  onSave,
  saveLabel,
  disableSave,
  onClear,
  onAddBatch,
  onRemoveBatch,
  stockLocationOptions,
  headerSlot,
}) => {
  const configForBusiness = InventoryFormConfig[businessType] || {};
  const sectionConfig = configForBusiness[sectionKey];

  if (!sectionConfig || sectionConfig.length === 0) {
    return <div className="text-sm text-gray-500">No fields configured.</div>;
  }

  const sectionData = formData[sectionKey] as any;
  const sectionErrors = (errors as Record<InventorySectionKey, any>)[sectionKey];

  const getValue = (field: FieldDef<any>): string => sectionData?.[field.name] ?? '';
  const getError = (field: FieldDef<any>): string | undefined => sectionErrors?.[field.name];

  const handleChange = (field: FieldDef<any>, value: string | string[], batchIndex?: number) => {
    onFieldChange(sectionKey, field.name, value, batchIndex);
  };

  const shouldHideField = (field: FieldDef<any>) => {
    const itemType = String(formData.classification?.itemType ?? '').toLowerCase();
    return sectionKey === 'classification' && itemType === 'non-drug'
      ? drugOnlyClassificationFields.has(String(field.name))
      : false;
  };

  const resolveDateChange = (
    next: Date | null | ((prev: Date | null) => Date | null),
    currentDate: Date | null,
    field: FieldDef<any>,
    index?: number
  ) => {
    const resolved = typeof next === 'function' ? next(currentDate) : next;
    if (!resolved) {
      handleChange(field, '', index);
      return;
    }
    handleChange(field, formatDate(resolved), index);
  };

  const renderField = (field: FieldDef<any>, key?: React.Key, index?: number) => {
    if (shouldHideField(field)) return null;
    const { placeholder, component, options } = field;
    const isBatch = sectionKey === 'batch' && typeof index === 'number';
    const value = isBatch
      ? ((formData.batches?.[index] as any)?.[field.name] ?? '')
      : getValue(field);
    const error = isBatch ? (errors.batch as any)?.[field.name] : getError(field);

    if (component === 'text') {
      const isReadOnlyAvailable = sectionKey === 'stock' && field.name === 'available';
      const resolvedValue = isReadOnlyAvailable
        ? String(getAvailableStock(formData) ?? toNumberSafe(value) ?? '')
        : value;
      return (
        <FormInput
          key={key ?? field.name}
          intype="text"
          inname={field.name}
          value={resolvedValue}
          inlabel={placeholder || ''}
          onChange={(e) => handleChange(field, e.target.value, index)}
          error={error}
          readonly={isReadOnlyAvailable}
          className="min-h-12!"
        />
      );
    }

    if (component === 'date') {
      const currentDate = parseDate(value);
      return (
        <div key={key ?? field.name} className="flex flex-col gap-1">
          <Datepicker
            currentDate={currentDate}
            setCurrentDate={(next: Date | null | ((prev: Date | null) => Date | null)) =>
              resolveDateChange(next, currentDate, field, index)
            }
            placeholder={placeholder || ''}
            type="input"
            className="min-h-12!"
            error={error}
          />
        </div>
      );
    }

    if (component === 'dropdown') {
      const isStockLocation =
        sectionKey === 'stock' &&
        field.name === 'stockLocation' &&
        stockLocationOptions &&
        stockLocationOptions.length > 0;
      // Subcategory options depend on the currently-selected category in the same
      // section, so they're scoped to that category instead of the full flat list.
      const isSubCategory = field.name === 'subCategory';
      let resolvedOptions: typeof options;
      if (isStockLocation) {
        resolvedOptions = stockLocationOptions;
      } else if (isSubCategory) {
        resolvedOptions = getSubCategoryOptions(sectionData?.category);
      } else {
        resolvedOptions = options || [];
      }
      const dropdownOptions = resolvedOptions.map((opt) =>
        typeof opt === 'string' ? { label: opt, value: opt } : opt
      );
      return (
        <LabelDropdown
          key={key ?? field.name}
          placeholder={placeholder || ''}
          defaultOption={value}
          onSelect={(opt) => handleChange(field, opt.value, index)}
          error={error}
          options={dropdownOptions}
        />
      );
    }

    if (component === 'multiSelect') {
      let arrayValue: string[];
      if (Array.isArray(value)) {
        arrayValue = value;
      } else if (value) {
        arrayValue = String(value)
          .split(',')
          .map((v) => v.trim());
      } else {
        arrayValue = [];
      }
      return (
        <MultiSelectDropdown
          key={key ?? field.name}
          placeholder={placeholder || ''}
          value={arrayValue}
          onChange={(vals) => handleChange(field, vals, index)}
          error={error}
          options={options || []}
        />
      );
    }

    if (component === 'textarea') {
      return (
        <FormDesc
          key={key ?? field.name}
          intype="text"
          inname={field.name}
          value={value}
          inlabel={placeholder || ''}
          onChange={(e) => handleChange(field, e.target.value, index)}
          className="min-h-[120px]!"
        />
      );
    }

    if (component === 'checkbox') {
      const checked = value === 'true' || value === 'Yes';
      return (
        <label
          key={key ?? field.name}
          className="flex min-h-10 cursor-pointer items-center gap-3 text-body-4 text-text-primary"
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => handleChange(field, e.target.checked ? 'true' : 'false', index)}
            className="size-5 rounded border-input-border-default accent-blue-text"
          />
          <span>{placeholder}</span>
        </label>
      );
    }

    if (component === 'upload') {
      return (
        <div key={key ?? field.name} className="relative">
          <div className="mb-1 px-4 text-caption-1 text-text-secondary">{placeholder}</div>
          <button
            type="button"
            className="flex min-h-35 w-full flex-col items-center justify-center rounded-2xl border border-input-border-default bg-white px-4 py-5 text-center text-text-primary"
            onClick={() => document.getElementById(`inventory-upload-${field.name}`)?.click()}
          >
            <RiUploadCloud2Fill size={34} className="text-blue-text" aria-hidden="true" />
            <span className="mt-2 text-body-4-emphasis">Upload document</span>
            <span className="text-caption-1 text-text-secondary">PNG, JPG, WebP</span>
            <span className="text-caption-1 text-text-secondary">Max size 2mb</span>
          </button>
          <input
            id={`inventory-upload-${field.name}`}
            type="file"
            className="hidden"
            aria-label={placeholder || 'Upload inventory image'}
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              handleChange(field, URL.createObjectURL(file), index);
            }}
          />
        </div>
      );
    }

    return null;
  };

  const renderItem = (item: ConfigItem<any>, index: number, batchIndex?: number) => {
    const itemKey =
      item.kind === 'row' ? item.fields.map((field) => field.name).join('-') : item.field.name;
    const fullKey = batchIndex === undefined ? itemKey : `${batchIndex}-${itemKey}`;
    if ('fields' in item && item.kind === 'row') {
      return (
        <div key={fullKey} className="grid grid-cols-2 gap-3">
          {item.fields.map((field, i) => renderField(field, `${index}-${i}`, batchIndex))}
        </div>
      );
    }

    return (
      <div key={fullKey} className="w-full">
        {renderField(item.field, index, batchIndex)}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between">
      <div className="flex flex-col gap-6">
        <div className="font-satoshi text-black-text text-[23px] font-medium">{sectionTitle}</div>

        <Accordion title={sectionTitle} defaultOpen showEditIcon={false} isEditing={true}>
          {sectionKey === 'batch' ? (
            <div className="flex flex-col gap-6">
              {(formData.batches && formData.batches.length > 0
                ? formData.batches
                : [formData.batch]
              ).map((batch, batchIdx) => (
                <div
                  key={batch._id ?? `batch-${batchIdx}`}
                  className="flex flex-col gap-3 border border-grey-light rounded-xl p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-satoshi font-semibold text-black-text">
                      Batch {batchIdx + 1}
                    </div>
                    {formData.batches && formData.batches.length > 1 && (
                      <button
                        type="button"
                        className="text-red-500 text-sm font-semibold"
                        onClick={() => onRemoveBatch?.(batchIdx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {sectionConfig.map((item, index) => renderItem(item, index, batchIdx))}
                  </div>
                </div>
              ))}
              <Secondary
                href="#"
                text="Add another batch"
                onClick={() => onAddBatch?.()}
                className="w-full! h-12! text-body-3-emphasis! font-satoshi font-semibold!"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {headerSlot}
              {sectionConfig.map((item, index) => renderItem(item, index))}
              {sectionKey === 'pricing' && <PricingSummary formData={formData} />}
            </div>
          )}
        </Accordion>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 pb-3">
        <Secondary
          href="#"
          text="Clear"
          onClick={onClear}
          isDisabled={disableSave}
          className="h-12! text-lg! tracking-[-0.36px]!"
        />
        <Primary
          href="#"
          text={saveLabel ?? 'Next'}
          className="h-12! text-lg! tracking-[-0.36px]!"
          onClick={onSave}
          isDisabled={disableSave}
        />
      </div>
    </div>
  );
};

export default FormSection;
