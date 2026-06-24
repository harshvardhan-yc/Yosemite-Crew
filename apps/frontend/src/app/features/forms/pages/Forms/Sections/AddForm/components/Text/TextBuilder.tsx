import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { FormField } from '@/app/features/forms/types/forms';

const TextBuilder: React.FC<{
  field: FormField & { type: 'textarea' };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => {
  const isTaskBlockField = Boolean((field as any).meta?.taskBlockKey);
  const defaultValueText =
    typeof (field as any).defaultValue === 'string' ? (field as any).defaultValue : '';

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
      <FormDesc
        intype="text"
        inname={isTaskBlockField ? 'defaultValue' : 'placeholder'}
        value={isTaskBlockField ? defaultValueText : field.placeholder || ''}
        inlabel={isTaskBlockField ? 'Default value (prefilled in schedule)' : 'Placeholder'}
        onChange={(e) =>
          onChange(
            isTaskBlockField
              ? { ...field, defaultValue: e.target.value }
              : { ...field, placeholder: e.target.value }
          )
        }
        className="min-h-[120px]! max-h-[120px]!"
      />
    </div>
  );
};

export default TextBuilder;
