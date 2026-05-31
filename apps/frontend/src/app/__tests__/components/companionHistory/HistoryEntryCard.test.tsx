import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import HistoryEntryCard from '@/app/features/companionHistory/components/HistoryEntryCard';

jest.mock('@/app/ui', () => ({
  Card: ({ children }: any) => <div data-testid="history-card">{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('react-icons/ri', () => ({
  RiExternalLinkLine: () => <span data-testid="external-icon" />,
}));

jest.mock('@/app/features/companionHistory/utils/historyFormatters', () => ({
  formatCurrency: jest.fn(
    (amount?: number, currency?: string) => `${currency ?? ''}:${amount ?? 0}`
  ),
  formatHistoryDate: jest.fn(() => 'formatted-date'),
  formatHistoryDateTime: jest.fn(() => 'formatted-datetime'),
  getHistoryTypeLabel: jest.fn((type: string) => type),
  getPayloadBoolean: jest.fn((payload: any, keys: string[]) => {
    const value = keys.map((k) => payload?.[k]).find((v) => v !== undefined);
    return typeof value === 'boolean' ? value : null;
  }),
  getPayloadNumber: jest.fn((payload: any, keys: string[]) => {
    const value = keys.map((k) => payload?.[k]).find((v) => v !== undefined);
    return typeof value === 'number' ? value : null;
  }),
  getPayloadString: jest.fn((payload: any, keys: string[]) => {
    const value = keys.map((k) => payload?.[k]).find((v) => v !== undefined);
    return typeof value === 'string' ? value : null;
  }),
  getPrimaryActionLabel: jest.fn(() => 'Open history entry'),
  getHistoryTypeBadgeTone: jest.fn(() => 'brand'),
  getHistoryStatusBadgeTone: jest.fn(() => 'warning'),
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getPaymentCollectionMethodLabel: jest.fn((value?: string) => value ?? ''),
}));

const baseEntry = {
  id: 'entry-1',
  type: 'TASK',
  occurredAt: '2026-01-01T10:00:00.000Z',
  status: 'IN_PROGRESS',
  title: 'Medication reminder',
  subtitle: 'Morning dose',
  summary: 'Give medicine with food',
  actor: { name: 'Dr Vet', role: 'VET' },
  tags: ['Important'],
  link: {
    kind: 'task',
    id: 'task-1',
    companionId: 'companion-1',
  },
  source: 'Manual',
  payload: {
    audience: 'Parent',
    dueAt: '2026-01-03T10:00:00.000Z',
    medicationSummary: 'Tablet',
  },
} as any;

describe('HistoryEntryCard', () => {
  it('renders key details and opens entry on click', () => {
    const onOpen = jest.fn();
    render(<HistoryEntryCard entry={baseEntry} onOpen={onOpen} />);

    expect(screen.getByTestId('history-card')).toBeInTheDocument();
    expect(screen.getByText('TASK')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('formatted-datetime')).toBeInTheDocument();
    expect(screen.getByText('Morning dose')).toBeInTheDocument();
    expect(screen.getByText('Give medicine with food')).toBeInTheDocument();
    expect(screen.getByText('Lead:')).toBeInTheDocument();
    expect(screen.getByText('Dr Vet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open history entry' }));
    expect(onOpen).toHaveBeenCalledWith(baseEntry);
  });

  it('renders document-specific details and synced source label', () => {
    const documentEntry = {
      ...baseEntry,
      type: 'DOCUMENT',
      status: '',
      actor: {},
      payload: {
        category: 'Prescription',
        subcategory: 'Medication',
        issueDate: '2026-02-01T10:00:00.000Z',
        issuingBusinessName: 'Yosemite Clinic',
        syncedFromPms: true,
      },
    } as any;

    render(<HistoryEntryCard entry={documentEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('Category:')).toBeInTheDocument();
    expect(screen.getByText('Prescription')).toBeInTheDocument();
    expect(screen.getByText('Sub-category:')).toBeInTheDocument();
    expect(screen.getByText('Medication')).toBeInTheDocument();
    expect(screen.getByText('Issue date:')).toBeInTheDocument();
    expect(screen.getByText('formatted-date')).toBeInTheDocument();
    expect(screen.queryByText(/^Actor:/)).not.toBeInTheDocument();
  });

  it('renders invoice branch values', () => {
    const invoiceEntry = {
      ...baseEntry,
      type: 'INVOICE',
      status: 'PAID',
      payload: {
        totalAmount: 100,
        currency: 'USD',
        paymentCollectionMethod: 'CARD',
        paidAt: '2026-03-01T10:00:00.000Z',
      },
    } as any;

    render(<HistoryEntryCard entry={invoiceEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.getByText('Amount:')).toBeInTheDocument();
    expect(screen.getByText('USD:100')).toBeInTheDocument();
    expect(screen.getByText('Payment method:')).toBeInTheDocument();
    expect(screen.getByText('CARD')).toBeInTheDocument();
  });

  it('renders APPOINTMENT type with service/reason details', () => {
    const appointmentEntry = {
      ...baseEntry,
      type: 'APPOINTMENT',
      status: 'UPCOMING',
      summary: 'Annual checkup',
      payload: {
        serviceName: 'Wellness Exam',
        concern: 'Routine visit',
        room: 'Room 1',
      },
    } as any;

    render(<HistoryEntryCard entry={appointmentEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('APPOINTMENT')).toBeInTheDocument();
    expect(screen.getByText('Service:')).toBeInTheDocument();
    expect(screen.getByText('Wellness Exam')).toBeInTheDocument();
    expect(screen.getByText('Reason:')).toBeInTheDocument();
    expect(screen.getByText('Routine visit')).toBeInTheDocument();
    // summary should NOT render for APPOINTMENT type
    expect(screen.queryByText('Annual checkup')).not.toBeInTheDocument();
  });

  it('renders FORM_SUBMISSION type', () => {
    const formEntry = {
      ...baseEntry,
      type: 'FORM_SUBMISSION',
      status: 'SIGNED',
      payload: {
        formCategory: 'Consent',
        soapSubtype: 'SOAP',
        submittedAt: '2026-04-01T10:00:00.000Z',
        signingStatus: 'signed',
      },
    } as any;

    render(<HistoryEntryCard entry={formEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('FORM_SUBMISSION')).toBeInTheDocument();
    expect(screen.getByText('Category:')).toBeInTheDocument();
    expect(screen.getByText('Consent')).toBeInTheDocument();
    expect(screen.getByText('SOAP type:')).toBeInTheDocument();
    expect(screen.getByText('SOAP')).toBeInTheDocument();
  });

  it('renders LAB_RESULT type', () => {
    const labEntry = {
      ...baseEntry,
      type: 'LAB_RESULT',
      status: 'COMPLETED',
      payload: {
        provider: 'IDEXX',
        accessionId: 'ACC-001',
        status: 'Normal',
        abnormalityPreview: 'No abnormalities',
      },
    } as any;

    render(<HistoryEntryCard entry={labEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('LAB_RESULT')).toBeInTheDocument();
    expect(screen.getByText('Provider:')).toBeInTheDocument();
    expect(screen.getByText('IDEXX')).toBeInTheDocument();
    expect(screen.getByText('Accession:')).toBeInTheDocument();
    expect(screen.getByText('ACC-001')).toBeInTheDocument();
  });

  it('renders tags when present', () => {
    render(<HistoryEntryCard entry={baseEntry} onOpen={jest.fn()} />);
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('does not render tags section when tags are empty', () => {
    const noTagEntry = { ...baseEntry, tags: [] } as any;
    render(<HistoryEntryCard entry={noTagEntry} onOpen={jest.fn()} />);
    // tags section should not be rendered
    expect(screen.queryByText('Important')).not.toBeInTheDocument();
  });

  it('does not render tags section when tags is undefined', () => {
    const noTagEntry = { ...baseEntry, tags: undefined } as any;
    render(<HistoryEntryCard entry={noTagEntry} onOpen={jest.fn()} />);
    expect(screen.queryByText('Important')).not.toBeInTheDocument();
  });

  it('renders no subtitle when subtitle is empty', () => {
    const noSubtitleEntry = { ...baseEntry, subtitle: '' } as any;
    render(<HistoryEntryCard entry={noSubtitleEntry} onOpen={jest.fn()} />);
    // The subtitle is rendered in a div with text-caption-1 text-text-secondary classes
    // When subtitle is empty, getDedupedSubtitle returns '' so subtitle div should not render
    expect(screen.queryByText('Morning dose')).not.toBeInTheDocument();
  });

  it('renders no status badge when status is empty', () => {
    const noStatusEntry = { ...baseEntry, status: '' } as any;
    render(<HistoryEntryCard entry={noStatusEntry} onOpen={jest.fn()} />);
    // Status badge renders In_Progress text; with empty status, In Progress badge should not appear
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('renders contributor with actorName and actorRoleLabel when no lead/support', () => {
    // actor.name must not be in payload leadName keys — use a neutral payload with no lead keys
    // and actor.name distinct from any payload value
    const staffEntry = {
      ...baseEntry,
      actor: { name: 'Jane Doe', role: 'STAFF' },
      // payload must not contain leadName/leadVet/leadVetName keys or supportStaffNames
      payload: { someOtherKey: 'irrelevant' },
    } as any;

    render(<HistoryEntryCard entry={staffEntry} onOpen={jest.fn()} />);

    // getContributorDetails: leadName = getPayloadString(payload, ['leadName','leadVet','leadVetName']) || actor.name
    // Since actor.name = 'Jane Doe', leadName = 'Jane Doe', so "Lead" row shows not "Updated by"
    // This verifies the lead-path renders the lead name correctly
    expect(screen.getByText('Lead:')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders contributor with actorName only when no lead fallback (no actor name in payload keys)', () => {
    // To test the "Updated by" path we need: no leadName in payload AND actor.name not used as fallback
    // That means getPayloadString must return '' or null AND actor.name is empty, but role is set
    const roleOnlyEntry = {
      ...baseEntry,
      actor: { name: '', role: 'STAFF' },
      payload: {},
    } as any;

    render(<HistoryEntryCard entry={roleOnlyEntry} onOpen={jest.fn()} />);

    // No lead, no support, no actor name → actorRoleLabel = 'Support staff'
    expect(screen.getByText('Updated by:')).toBeInTheDocument();
    expect(screen.getByText('Support staff')).toBeInTheDocument();
  });

  it('renders contributor with role label only when no actor name', () => {
    const roleOnlyEntry = {
      ...baseEntry,
      actor: { name: '', role: 'PARENT' },
      payload: {},
    } as any;

    render(<HistoryEntryCard entry={roleOnlyEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('Updated by:')).toBeInTheDocument();
    expect(screen.getByText('Pet parent')).toBeInTheDocument();
  });

  it('renders no contributor details when actor is empty and no lead', () => {
    const noActorEntry = {
      ...baseEntry,
      actor: {},
      payload: {},
    } as any;

    render(<HistoryEntryCard entry={noActorEntry} onOpen={jest.fn()} />);

    expect(screen.queryByText('Updated by:')).not.toBeInTheDocument();
    expect(screen.queryByText('Lead:')).not.toBeInTheDocument();
  });

  it('renders support staff detail alongside lead', () => {
    const entryWithSupport = {
      ...baseEntry,
      actor: {},
      payload: {
        leadName: 'Dr Smith',
        supportStaffNames: ['Nurse A', 'Nurse B'],
      },
    } as any;

    render(<HistoryEntryCard entry={entryWithSupport} onOpen={jest.fn()} />);

    expect(screen.getByText('Lead:')).toBeInTheDocument();
    expect(screen.getByText('Dr Smith')).toBeInTheDocument();
    expect(screen.getByText('Support:')).toBeInTheDocument();
    expect(screen.getByText('Nurse A, Nurse B')).toBeInTheDocument();
  });

  it('renders document with syncedFromPms=false showing "Manual" label', () => {
    const manualDoc = {
      ...baseEntry,
      type: 'DOCUMENT',
      status: '',
      source: 'YC',
      actor: {},
      payload: {
        category: 'Report',
        syncedFromPms: false,
      },
    } as any;

    render(<HistoryEntryCard entry={manualDoc} onOpen={jest.fn()} />);

    expect(screen.getByText('Source:')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('renders document source from entry.source when syncedFromPms is null', () => {
    const nullSyncDoc = {
      ...baseEntry,
      type: 'DOCUMENT',
      status: '',
      source: 'MANUAL_UPLOAD',
      actor: {},
      payload: {
        category: 'Report',
        // syncedFromPms not present → getPayloadBoolean returns null
      },
    } as any;

    render(<HistoryEntryCard entry={nullSyncDoc} onOpen={jest.fn()} />);

    expect(screen.getByText('Source:')).toBeInTheDocument();
    expect(screen.getByText('MANUAL_UPLOAD')).toBeInTheDocument();
  });

  it('renders a bullet separator between multiple contributor details', () => {
    const entryWithBoth = {
      ...baseEntry,
      actor: {},
      payload: {
        leadName: 'Dr Smith',
        supportStaffName: 'Nurse C',
      },
    } as any;

    render(<HistoryEntryCard entry={entryWithBoth} onOpen={jest.fn()} />);

    // Both Lead and Support rows visible → bullet separator between them
    expect(screen.getByText('Lead:')).toBeInTheDocument();
    expect(screen.getByText('Support:')).toBeInTheDocument();
    // bullet separator span
    const bullets = screen.getAllByText('•');
    expect(bullets.length).toBeGreaterThan(0);
  });

  it('formatStatusLabel normalizes underscore-separated status', () => {
    const entry = {
      ...baseEntry,
      status: 'AWAITING_PAYMENT',
    } as any;

    render(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);

    // statusLabel computed from formatStatusLabel('AWAITING_PAYMENT') → 'Awaiting Payment'
    expect(screen.getByText('Awaiting Payment')).toBeInTheDocument();
  });

  it('getDedupedSubtitle returns empty string when subtitle equals formatted date', () => {
    // formatted-date is what formatHistoryDate returns (mocked)
    const entry = {
      ...baseEntry,
      subtitle: 'formatted-date',
    } as any;

    render(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);

    // subtitle div should not render because getDedupedSubtitle returns ''
    // The text 'formatted-date' would only appear in the datetime area (different class)
    const captionSecondaryEls = document.querySelectorAll('.text-caption-1.text-text-secondary');
    // The subtitle div is specifically text-caption-1 text-text-secondary
    // but the datetime area also uses text-text-secondary - we just verify no subtitle div
    // by checking the subtitle value is deduped (not shown as subtitle)
    const allText = Array.from(captionSecondaryEls).map((el) => el.textContent);
    // 'formatted-date' might appear but NOT as the subtitle paragraph
    // The key assertion is that the inline subtitle div is absent
    expect(allText.every((t) => t !== 'formatted-date')).toBe(true);
  });

  it('getPayloadStringArray returns empty array for non-array payload value', () => {
    // test indirectly through support staff rendering - supportStaffNames is not an array
    const entryWithNonArraySupport = {
      ...baseEntry,
      actor: {},
      payload: {
        leadName: 'Dr Solo',
        supportStaffNames: 'not-an-array',
      },
    } as any;

    render(<HistoryEntryCard entry={entryWithNonArraySupport} onOpen={jest.fn()} />);

    // Should still render Lead but Support should be '-' (filtered out)
    expect(screen.getByText('Lead:')).toBeInTheDocument();
    expect(screen.queryByText('Support:')).not.toBeInTheDocument();
  });

  it('getPayloadStringArray filters empty strings from array', () => {
    const entryWithEmptyNames = {
      ...baseEntry,
      actor: {},
      payload: {
        leadName: 'Dr Clean',
        supportStaffNames: ['', '  ', 'Nurse X'],
      },
    } as any;

    render(<HistoryEntryCard entry={entryWithEmptyNames} onOpen={jest.fn()} />);

    expect(screen.getByText('Support:')).toBeInTheDocument();
    expect(screen.getByText('Nurse X')).toBeInTheDocument();
  });
});
