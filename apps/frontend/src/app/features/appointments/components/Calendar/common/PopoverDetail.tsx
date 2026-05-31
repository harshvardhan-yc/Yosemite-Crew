import React from 'react';

type PopoverDetailProps = {
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
  icon?: React.ReactNode;
  scrollValue?: boolean;
};

const PopoverDetail = ({
  label,
  value,
  emphasized = false,
  icon,
  scrollValue = false,
}: PopoverDetailProps) => (
  <div className="min-w-0">
    <div className="text-yc-12-b-neutral">{label}</div>
    <div className={`mt-1 min-w-0 ${emphasized ? 'text-yc-16-b-primary' : 'text-yc-16-r-neutral'}`}>
      <span className="relative block min-w-0 overflow-visible">
        {icon ? (
          <span className="pointer-events-none absolute -left-5 top-1/2 -translate-y-1/2 text-neutral-900">
            {icon}
          </span>
        ) : null}
        <span
          className={
            scrollValue
              ? 'scrollbar-x-float block max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap pb-3'
              : 'block truncate'
          }
          onWheel={
            scrollValue
              ? (e) => {
                  if (e.deltaY !== 0) {
                    e.preventDefault();
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }
              : undefined
          }
        >
          {value}
        </span>
      </span>
    </div>
  </div>
);

export default PopoverDetail;
