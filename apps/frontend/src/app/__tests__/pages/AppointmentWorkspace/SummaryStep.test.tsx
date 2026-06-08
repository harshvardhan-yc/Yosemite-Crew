import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SummaryStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';

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
    renderSummary(enc);

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

  it('applies a discharge template from search', () => {
    const enc = seedAndGet();
    renderSummary(enc);

    fireEvent.change(screen.getByLabelText(/search discharge templates/i), {
      target: { value: 'post' },
    });
    fireEvent.click(screen.getByRole('button', { name: /post-operative discharge/i }));

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
});
