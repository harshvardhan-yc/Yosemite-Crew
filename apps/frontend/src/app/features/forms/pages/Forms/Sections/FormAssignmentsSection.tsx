'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { listOrganisationFormAssignments } from '@/app/features/forms/services/formAssignmentService';
import {
  getFormAssignmentBadge,
  type FormAssignmentBadgeTone,
} from '@/app/features/forms/lib/formAssignmentBadge';
import type { FormAssignmentListItem } from '@/app/features/forms/types/forms';

const TONE_CLASS: Record<FormAssignmentBadgeTone, string> = {
  warning: 'bg-[#FFF4E5] text-[#B25E02]',
  success: 'bg-[#E6F4EA] text-[#1E7E34]',
  danger: 'bg-[#FDECEC] text-[#C62828]',
  neutral: 'bg-neutral-100 text-neutral-600',
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/** The most recent meaningful lifecycle timestamp for the row. */
const relevantTimestamp = (item: FormAssignmentListItem): string | null =>
  item.signedAt ?? item.cancelledAt ?? item.expiredAt ?? item.submittedAt ?? item.viewedAt ?? null;

type FormAssignmentsSectionProps = {
  organisationId: string | null;
};

const FormAssignmentsSection = ({ organisationId }: FormAssignmentsSectionProps) => {
  const [assignments, setAssignments] = useState<FormAssignmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(false);
    try {
      const rows = await listOrganisationFormAssignments(organisationId);
      setAssignments(rows);
    } catch (err) {
      console.error('Failed to load form assignments', err);
      setError(true);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-text-tertiary text-body-3">
        Loading assigned forms…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-text-secondary text-body-3">
          We couldn&rsquo;t load assigned forms right now.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="text-text-brand text-body-3 underline-offset-2 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-text-primary text-body-2">No assigned forms yet</p>
        <p className="text-text-tertiary text-body-4">
          Forms you send to pet parents will appear here with their status.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
      {assignments.map((item) => {
        const badge = getFormAssignmentBadge(item.status);
        const recipient = [item.parentName, item.companionName].filter(Boolean).join(' · ');
        const signedPdfUrl =
          item.status === 'SIGNED' ? (item.signedDocument?.pdfUrl ?? null) : null;
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border bg-neutral-0 px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-text-primary text-body-2 font-medium">
                {item.templateTitle || item.templateName}
              </span>
              <span className="truncate text-text-tertiary text-body-4">
                {recipient || 'Unassigned recipient'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-tertiary text-body-4">
                {formatDate(relevantTimestamp(item))}
              </span>
              {signedPdfUrl ? (
                <a
                  href={signedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-brand text-body-4 underline-offset-2 hover:underline"
                >
                  View PDF
                </a>
              ) : null}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-body-4 font-medium ${TONE_CLASS[badge.tone]}`}
              >
                {badge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FormAssignmentsSection;
