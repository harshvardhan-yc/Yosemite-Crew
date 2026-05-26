import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';
import './ButtonEffects.css';

type PrimaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[11px]',
  large: 'py-[11px] md:py-[14px]',
};

const baseClasses =
  'yc-primary-button px-8 flex items-center justify-center rounded-2xl! transition-[background-color,border-color] duration-200 ease-out font-satoshi text-base font-medium leading-[1.2] text-center text-neutral-0!';

const Primary = ({ className, style, ...rest }: Readonly<PrimaryProps>) => (
  <BaseButton
    {...rest}
    className={className}
    style={{ backgroundColor: 'var(--color-text-primary)', ...style }}
    sizeClasses={sizeClasses}
    baseClasses={baseClasses}
  />
);

export default Primary;
