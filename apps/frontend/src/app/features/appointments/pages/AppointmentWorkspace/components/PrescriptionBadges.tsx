import React from 'react';

/**
 * Small "+" affordance shown at the start of a floating container title
 * (Services & Packages / Prescription). Decorative blue blur circle with a
 * white plus glyph.
 */
export const TitleAddIcon = () => (
  <span
    aria-hidden="true"
    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-text-brand"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8.00016 3.3335V12.6668M3.3335 8.00016H12.6668"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

/** Rx pill badge shown beside a medicine name. */
export const RxBadge = () => (
  <span
    role="img"
    aria-label="Prescription"
    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-text-brand bg-primary-100"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.9165 2.91667C2.9165 2.60725 3.03942 2.3105 3.25821 2.09171C3.47701 1.87292 3.77375 1.75 4.08317 1.75H6.70817C7.40436 1.75 8.07204 2.02656 8.56433 2.51884C9.05661 3.01113 9.33317 3.67881 9.33317 4.375C9.33317 5.07119 9.05661 5.73887 8.56433 6.23116C8.07204 6.72344 7.40436 7 6.70817 7H6.658L8.74984 9.09183L10.0874 7.75425C10.1974 7.64799 10.3448 7.58919 10.4977 7.59052C10.6507 7.59185 10.797 7.6532 10.9051 7.76136C11.0133 7.86951 11.0747 8.01582 11.076 8.16877C11.0773 8.32171 11.0185 8.46907 10.9123 8.57908L9.57467 9.91667L10.9123 11.2543C11.0185 11.3643 11.0773 11.5116 11.076 11.6646C11.0747 11.8175 11.0133 11.9638 10.9051 12.072C10.797 12.1801 10.6507 12.2415 10.4977 12.2428C10.3448 12.2441 10.1974 12.1853 10.0874 12.0791L8.74984 10.7415L7.41225 12.0791C7.30224 12.1853 7.15488 12.2441 7.00194 12.2428C6.84899 12.2415 6.70268 12.1801 6.59453 12.072C6.48637 11.9638 6.42502 11.8175 6.42369 11.6646C6.42236 11.5116 6.48116 11.3643 6.58742 11.2543L7.925 9.91667L5.00834 7H4.08317V9.91667C4.08317 10.0714 4.02171 10.2198 3.91232 10.3291C3.80292 10.4385 3.65455 10.5 3.49984 10.5C3.34513 10.5 3.19675 10.4385 3.08736 10.3291C2.97796 10.2198 2.9165 10.0714 2.9165 9.91667V2.91667ZM4.08317 5.83333H6.70817C7.09494 5.83333 7.46588 5.67969 7.73937 5.4062C8.01286 5.13271 8.1665 4.76177 8.1665 4.375C8.1665 3.98823 8.01286 3.61729 7.73937 3.3438C7.46588 3.07031 7.09494 2.91667 6.70817 2.91667H4.08317V5.83333Z"
        fill="#006AE0"
      />
    </svg>
  </span>
);

/**
 * Stock-health pill: green "In stock" or amber "Low stock", with the on-hand
 * count in an inner circle.
 */
export const StockHealthPill = ({ qty, low }: { qty: number; low: boolean }) => (
  <span
    className={`flex h-8 items-center gap-2 rounded-2xl border py-2 pr-1 pl-3 text-caption-2 font-medium shadow-[0_1px_10px_0_rgba(169,163,158,0.10)] ${
      low
        ? 'border-pill-warning-text bg-pill-warning-bg text-pill-warning-text'
        : 'border-pill-success-text bg-pill-success-bg text-pill-success-text'
    }`}
  >
    {low ? 'Low stock' : 'In stock'}
    <span
      className={`flex size-6 items-center justify-center rounded-2xl text-[11px] leading-none font-bold text-neutral-0 ${
        low ? 'bg-warning-700' : 'bg-pill-success-text'
      }`}
    >
      {qty}
    </span>
  </span>
);
