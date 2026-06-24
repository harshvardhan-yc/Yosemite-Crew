import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { FormField } from '@/app/features/forms/types/forms';

/**
 * Runtime renderer for a rich-text field. Emits sanitized HTML via the shared
 * RichTextEditor so the value can be stored and sent to the backend as-is.
 */
const RichTextRenderer: React.FC<{
  field: FormField & { type: 'richtext' };
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly }) => (
  <div className="flex flex-col gap-2">
    {field.label && (
      <span className="font-satoshi text-black-text text-[16px] font-medium">{field.label}</span>
    )}
    <RichTextEditor
      ariaLabel={field.label || 'Rich text'}
      value={value ?? ''}
      onChange={onChange}
      placeholder={field.placeholder || ''}
      readOnly={readOnly}
      toolbarPlacement="inline"
    />
  </div>
);

export default RichTextRenderer;
