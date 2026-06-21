import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SummaryStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import { listDischargeSummaryTemplates } from '@/app/features/appointments/services/workspaceTemplateService';
import { getRenderedDocument } from '@/app/features/appointments/services/workspaceClinicalService';

jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listDischargeSummaryTemplates: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  getRenderedDocument: jest.fn(),
  saveDischargeSummaryArtifact: jest.fn().mockResolvedValue({ id: 'saved-summary' }),
}));

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({ open, title, pdfUrl }: { open: boolean; title: string; pdfUrl: string | null }) =>
    open ? (
      <div data-testid="pdf-preview">
        <span>{title}</span>
        <span>{pdfUrl}</span>
      </div>
    ) : null,
}));

expect.extend(toHaveNoViolations);

// Lightweight Datepicker mock exposing set/clear so the follow-up wiring can be
// exercised without driving the real react-datepicker calendar in jsdom.
jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({
    placeholder,
    currentDate,
    setCurrentDate,
  }: {
    placeholder: string;
    currentDate: Date | null;
    setCurrentDate: (next: Date | null) => void;
  }) => (
    <div>
      <button type="button" aria-label={`${placeholder}: ${currentDate?.toISOString() ?? 'none'}`}>
        {placeholder}
      </button>
      <button type="button" onClick={() => setCurrentDate(new Date('2026-05-10T00:00:00Z'))}>
        mock pick date
      </button>
      <button type="button" onClick={() => setCurrentDate(null)}>
        mock clear date
      </button>
    </div>
  ),
}));

const APPT = 'appt-summary';
const appointment = {
  id: APPT,
  organisationId: 'org-1',
  encounterId: 'enc-1',
} as any;

const reset = () => {
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SUMMARY',
    activeSideAction: null,
  });
  useSigningOverlayStore.setState({
    open: false,
    url: null,
    pending: false,
    submissionId: null,
  });
  (listDischargeSummaryTemplates as jest.Mock).mockResolvedValue([]);
  (getRenderedDocument as jest.Mock).mockResolvedValue({ pdfUrl: 'https://files.test/doc.pdf' });
};

const seedAndGet = () => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'OUTPATIENT');
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

const renderSummary = (encounter: AppointmentEncounter) => {
  render(<SummaryStep appointmentId={APPT} encounter={encounter} />);
};

describe('SummaryStep', () => {
  beforeEach(reset);

  it('renders discharge summary, follow-up date field and all documents', () => {
    const enc = seedAndGet();
    const withDocument = {
      ...enc,
      documents: [
        {
          id: 'doc-soap-1',
          createdAt: '2026-04-20T12:30:00Z',
          category: 'SOAP' as const,
          description: 'Signed SOAP note',
          signedByName: 'Dr. Tim Apple',
          lastModifiedAt: '2026-04-20T12:45:00Z',
        },
      ],
    };
    renderSummary(withDocument);

    expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Discharge summary')).toBeInTheDocument();
    // Follow-up is now a date-picker field labelled "Follow up date".
    expect(screen.getByRole('button', { name: /follow up date/i })).toBeInTheDocument();
    expect(screen.getByText('All Documents')).toBeInTheDocument();
    expect(screen.getByText('Signed SOAP note')).toBeInTheDocument();
  });

  it('places the follow-up date field after the discharge editor', () => {
    const enc = seedAndGet();
    renderSummary(enc);
    const editor = screen.getByLabelText('Discharge summary');
    const followUp = screen.getByRole('button', { name: /follow up date/i });
    // The follow-up field sits below the editor (the Record Vitals slot).
    expect(editor.compareDocumentPosition(followUp)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('applies a discharge template from search', async () => {
    (listDischargeSummaryTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-discharge-1',
        name: 'Post-operative discharge',
        schemaSnapshot: {
          sections: [
            {
              id: 'instructions',
              title: 'Care instructions',
              fields: [{ key: 'rest', label: 'Keep the patient rested' }],
            },
          ],
        },
      },
    ]);
    const enc = seedAndGet();
    await act(async () => {
      render(<SummaryStep appointmentId={APPT} appointment={appointment} encounter={enc} />);
    });

    fireEvent.change(screen.getByLabelText(/search discharge templates/i), {
      target: { value: 'post' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /post-operative discharge/i }));

    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.dischargeSummary).toContain(
      'Keep the patient rested'
    );
  });

  it('passes an existing follow-up date into the picker field', () => {
    const enc = { ...seedAndGet(), followUpAt: '2026-05-10T12:00:00Z' };
    renderSummary(enc);
    expect(
      screen.getByRole('button', { name: /follow up date: 2026-05-10t12:00:00/i })
    ).toBeInTheDocument();
  });

  it('treats an invalid stored follow-up date as empty', () => {
    const enc = { ...seedAndGet(), followUpAt: 'not-a-date' };
    renderSummary(enc);
    // Invalid timestamp resolves to no date and no follow-up stamp.
    expect(screen.getByRole('button', { name: /follow up date: none/i })).toBeInTheDocument();
    expect(screen.queryByText('Follow-up:')).not.toBeInTheDocument();
  });

  it('records and clears the follow-up date through the picker', () => {
    const enc = seedAndGet();
    renderSummary(enc);

    fireEvent.click(screen.getByRole('button', { name: 'mock pick date' }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.followUpAt).toBe(
      '2026-05-10T00:00:00.000Z'
    );

    fireEvent.click(screen.getByRole('button', { name: 'mock clear date' }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.followUpAt).toBeUndefined();
  });

  it('signs summary, adds a document and opens the signing overlay', () => {
    const enc = seedAndGet();
    const before = enc.documents.length;
    renderSummary(enc);

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    expect(updated.documents).toHaveLength(before + 1);
    expect(updated.documents[0].description).toBe('Signed discharge summary');
    expect(updated.stepStatus.SUMMARY).toBe('COMPLETED');
    expect(useSigningOverlayStore.getState().open).toBe(true);
    expect(screen.getByText('Preparing signing session...')).toBeInTheDocument();
  });

  it('prints all documents', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    renderSummary(seedAndGet());

    fireEvent.click(screen.getByRole('button', { name: /^print$/i }));

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('opens an existing workspace document PDF', async () => {
    const enc = {
      ...seedAndGet(),
      documents: [
        {
          id: 'doc-1',
          pdfUrl: 'https://files.test/direct.pdf',
          createdAt: '2026-04-20T12:30:00Z',
          category: 'SOAP' as const,
          description: 'Signed SOAP note',
          signedByName: 'Dr. Tim Apple',
          lastModifiedAt: '2026-04-20T12:45:00Z',
        },
      ],
    };
    renderSummary(enc);

    fireEvent.click(screen.getByRole('button', { name: /view signed soap note/i }));

    await waitFor(() => {
      expect(screen.getByTestId('pdf-preview')).toHaveTextContent('Signed SOAP note');
    });
    expect(screen.getByTestId('pdf-preview')).toHaveTextContent('https://files.test/direct.pdf');
    expect(getRenderedDocument).not.toHaveBeenCalled();
  });

  it('looks up a rendered document PDF when the document row has no direct URL', async () => {
    const enc = {
      ...seedAndGet(),
      documents: [
        {
          id: 'rendered-1',
          createdAt: '2026-04-20T12:30:00Z',
          category: 'Discharge' as const,
          description: 'Discharge summary',
          lastModifiedAt: '2026-04-20T12:45:00Z',
        },
      ],
    };
    render(<SummaryStep appointmentId={APPT} appointment={appointment} encounter={enc} />);

    fireEvent.click(screen.getByRole('button', { name: /view discharge summary/i }));

    await waitFor(() => {
      expect(getRenderedDocument).toHaveBeenCalledWith('org-1', 'rendered-1');
    });
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent('Discharge summary');
    expect(screen.getByTestId('pdf-preview')).toHaveTextContent('https://files.test/doc.pdf');
  });

  it('downloads a workspace document PDF', async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const enc = {
      ...seedAndGet(),
      documents: [
        {
          id: 'doc-download',
          pdfUrl: 'https://files.test/download.pdf',
          createdAt: '2026-04-20T12:30:00Z',
          category: 'SOAP' as const,
          description: 'Signed SOAP note',
          lastModifiedAt: '2026-04-20T12:45:00Z',
        },
      ],
    };
    renderSummary(enc);

    fireEvent.click(screen.getByRole('button', { name: /download signed soap note/i }));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    clickSpy.mockRestore();
  });

  it('disables editing controls in read-only mode and shows empty documents', () => {
    const enc = {
      ...seedAndGet(),
      viewOnly: true,
      documents: [],
    };
    renderSummary(enc);

    expect(screen.getByText('No documents recorded yet.')).toBeInTheDocument();
    // The follow-up picker is wrapped in a non-interactive (aria-disabled) shell.
    const followUpButton = screen.getByRole('button', { name: /follow up date/i });
    expect(followUpButton.closest('[aria-disabled="true"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeDisabled();
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('derives document rows from saved SOAP notes and prescriptions', () => {
    const enc = {
      ...seedAndGet(),
      soap: [
        {
          id: 'note-1',
          chiefComplaint: '',
          subjective: '<p>Lethargy</p>',
          objective: '',
          assessment: '',
          plan: '',
          status: 'COMPLETED' as const,
          createdAt: '2026-04-20T12:30:00Z',
        },
      ],
      prescription: [{ id: 'rx-1', medicineName: 'Amoxicillin', fulfillment: 'IN_HOUSE' as const }],
    } as AppointmentEncounter;
    renderSummary(enc);

    expect(screen.getByText('SOAP note')).toBeInTheDocument();
    expect(screen.getByText(/Prescription — Amoxicillin/)).toBeInTheDocument();
  });

  it('does not render the terminal Complete button inside the summary body', () => {
    const enc = seedAndGet();
    render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(screen.queryByRole('button', { name: /discharge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^complete$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^print$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeInTheDocument();
  });

  it('does not render inline discharge date/time fields for inpatient confirmation', () => {
    useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'INPATIENT');
    const enc = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(screen.queryByText('Discharge date & time')).not.toBeInTheDocument();
  });

  it('keeps discharge date/time out of the summary body once discharged', () => {
    useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'INPATIENT');
    const enc = {
      ...useAppointmentWorkspaceStore.getState().getEncounter(APPT)!,
      dischargedAt: '2026-05-01T10:00:00Z',
    } as AppointmentEncounter;
    render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(screen.queryByText('Discharge date & time')).not.toBeInTheDocument();
  });
});
