import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { FormField } from '@/app/features/forms/types/forms';

const InputBuilder: React.FC<{
  field: FormField & { type: 'input' | 'number' };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => {
  const isReadOnly = (field as any).meta?.readonly;
  const displayValue = (field as any).defaultValue ?? field.placeholder ?? '';
  // Editable medication-row fields (frequency / duration) carry an inventoryItemId. For these we
  // let the author set a default value that preloads into the workspace prescription section when
  // the template is applied. Other (generic custom) input fields keep label/placeholder only.
  const isTemplateDefaultField = Boolean(
    (field as any).meta?.inventoryItemId || (field as any).meta?.taskBlockKey
  );
  const defaultValueText =
    typeof (field as any).defaultValue === 'string' ? (field as any).defaultValue : '';

  if (isReadOnly) {
    // For readonly fields, show both label and value as readonly (from inventory)
    return (
      <div className="flex flex-col gap-3">
        <FormInput
          intype="text"
          inname="Label"
          value={field.label || ''}
          inlabel="Label (from inventory)"
          readonly={true}
          className="min-h-12!"
        />
        <FormInput
          intype={field.type === 'number' ? 'number' : 'text'}
          inname="value"
          value={displayValue}
          inlabel="Value (from inventory)"
          readonly={true}
          className="min-h-12!"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormInput
        intype="text"
        inname="Label"
        value={field.label || ''}
        inlabel="Label"
        onChange={(e) => onChange({ ...field, label: e.target.value })}
        className="min-h-12!"
      />
      <FormInput
        intype={field.type === 'number' ? 'number' : 'text'}
        inname="placeholder"
        value={field.placeholder || ''}
        inlabel="Placeholder"
        onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
        className="min-h-12!"
      />
      {isTemplateDefaultField && (
        <FormInput
          intype={field.type === 'number' ? 'number' : 'text'}
          inname="defaultValue"
          value={defaultValueText}
          inlabel="Default value (prefilled in workspace)"
          onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
          className="min-h-12!"
        />
      )}
    </div>
  );
};

export default InputBuilder;
