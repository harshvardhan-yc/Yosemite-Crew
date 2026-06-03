import React from 'react';
import type { AlertSeverity } from '@/app/features/appointments/types/workspace';

type AlertPillProps = {
  label: string;
  severity: AlertSeverity;
};

const SEVERITY_BG: Record<AlertSeverity, string> = {
  CAUTION: 'var(--color-category-caution)',
  MEDICAL: 'var(--color-category-medical)',
  INFO: 'var(--color-category-info)',
  ATTENTION: 'var(--color-category-attention)',
  ADMIN: 'var(--color-category-admin)',
};

/** Companion alert pill — white text on a severity-coloured rounded background. */
const AlertPill = ({ label, severity }: AlertPillProps) => (
  <span
    className="flex h-5 items-center justify-center gap-2 rounded-2xl px-2 text-[12px] font-medium leading-[120%] text-neutral-0"
    style={{ backgroundColor: SEVERITY_BG[severity] }}
  >
    {label}
  </span>
);

export default AlertPill;
