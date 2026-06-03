import React, { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type { PaymentMethod } from '@/app/features/appointments/types/workspace';

type PaymentMethodMenuProps = {
  label: string;
  disabled?: boolean;
  onSelect: (method: PaymentMethod) => void;
};

const PAYMENT_OPTIONS: { label: string; value: PaymentMethod }[] = [
  { label: 'Pay via Cash', value: 'CASH' },
  { label: 'Pay via Card', value: 'CARD' },
  { label: 'Collect Deposit', value: 'DEPOSIT' },
  { label: 'Pay Online', value: 'ONLINE' },
];

const PaymentMethodMenu = ({ label, disabled = false, onSelect }: PaymentMethodMenuProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (method: PaymentMethod) => {
    onSelect(method);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Primary
        text={label}
        icon={<LuChevronDown aria-hidden="true" />}
        onClick={() => setOpen((value) => !value)}
        isDisabled={disabled}
        ariaLabel={label}
      />
      {open && (
        <div className="absolute right-0 z-20 mt-2 flex min-w-48 flex-col gap-2 rounded-2xl border border-card-border bg-neutral-0 p-2 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
          {PAYMENT_OPTIONS.map((option) => (
            <Secondary
              key={option.value}
              text={option.label}
              onClick={() => handleSelect(option.value)}
              className="justify-start"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentMethodMenu;
