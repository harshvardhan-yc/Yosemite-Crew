import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SummaryStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';

expect.extend(toHaveNoViolations);

const APPT = 'appt-summary';

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal',
  () => ({
    __esModule: true,
    default: ({ showModal }: { showModal: boolean }) =>
      showModal ? <div data-testid="follow-up-modal">Follow-up modal</div> : null,
  })
);

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

  it('renders discharge summary, follow-up control and all documents', () => {
    const enc = seedAndGet();
    renderSummary(enc);

    expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Discharge summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Follow-up date')).toBeInTheDocument();
    expect(screen.getByText('All Documents')).toBeInTheDocument();
    expect(screen.getByText('Signed SOAP note')).toBeInTheDocument();
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

  it('sets follow-up date and shows booking requested status', () => {
    const enc = seedAndGet();
    renderSummary(enc);

    fireEvent.change(screen.getByLabelText('Follow-up date'), {
      target: { value: '2026-05-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: /book follow up/i }));

    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.followUpAt).toBe(
      '2026-05-10T12:00:00Z'
    );
    expect(screen.getByText('Follow-up booking requested.')).toBeInTheDocument();
    expect(screen.getByTestId('follow-up-modal')).toBeInTheDocument();
  });

  it('signs summary, adds a document and opens the signing overlay', () => {
    const enc = seedAndGet();
    const before = enc.documents.length;
    renderSummary(enc);

    fireEvent.click(screen.getByRole('button', { name: /sign & save/i }));

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

    fireEvent.click(screen.getByRole('button', { name: /print all/i }));

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
    expect(screen.getByLabelText('Follow-up date')).toBeDisabled();
    expect(screen.getByRole('button', { name: /book follow up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /sign & save/i })).toBeDisabled();
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
