import React from 'react';

type SectionContainerProps = {
  title: string;
  children: React.ReactNode;
  nested?: boolean;
  className?: string;
  titleColor?: string;
  titleSlot?: React.ReactNode;
};

const SectionContainer = ({
  title,
  children,
  nested = false,
  className,
  titleColor,
  titleSlot,
}: SectionContainerProps) => {
  const titleSize = nested
    ? 'text-[14px] sm:text-[16px] font-medium'
    : 'text-[16px] sm:text-[20px] font-medium';

  const resolvedTitleColor = titleColor ?? 'var(--color-input-border-active)';

  return (
    <div
      className={`relative rounded-2xl border border-input-border-default focus-within:border-input-border-active transition-colors duration-150 pb-5 px-5 ${nested ? 'pt-7' : 'pt-9'} ${className ?? ''}`}
    >
      {/* Title floats on the top border — capped so it never runs into the right slot */}
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0 left-4 -translate-y-1/2 bg-(--whitebg) px-1.5 leading-none truncate ${titleSize} ${titleSlot ? 'max-w-[55%] sm:max-w-[60%]' : 'max-w-[calc(100%-2rem)]'}`}
        style={{ color: resolvedTitleColor }}
      >
        {title}
      </span>
      {titleSlot && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 right-4 -translate-y-1/2 bg-(--whitebg) px-1.5 leading-none flex items-center gap-1.5 shrink-0"
        >
          {titleSlot}
        </span>
      )}
      {children}
    </div>
  );
};

export default SectionContainer;
