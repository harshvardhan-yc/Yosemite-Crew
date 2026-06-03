import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SoapStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SoapStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';

expect.extend(toHaveNoViolations);

const APPT = 'appt-soap';
const APPOINTMENT_REASON = 'Limping after a long hike';

const onRecordVitals = jest.fn();

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });

const seedAndGet = () => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'OUTPATIENT');
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

describe('SoapStep', () => {
  beforeEach(reset);

  const renderSoapStep = (encounter = seedAndGet()) =>
    render(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={encounter}
        onRecordVitals={onRecordVitals}
      />
    );

  it('renders the four SOAP sections and chief complaint', () => {
    renderSoapStep();
    expect(screen.getByText('Chief Complaint')).toBeInTheDocument();
    expect(screen.getByText('Appointment reason')).toBeInTheDocument();
    expect(screen.getByText(APPOINTMENT_REASON)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Chief complaint' })).not.toBeInTheDocument();
    expect(screen.getByText('Subjective (History)')).toBeInTheDocument();
    expect(screen.getByText('Objective (Examination)')).toBeInTheDocument();
    expect(screen.getByText('Assessment (Differential)')).toBeInTheDocument();
    expect(screen.getAllByText('Plan').length).toBeGreaterThan(0);
  });

  it('keeps SOAP template search between chief complaint and subjective', () => {
    renderSoapStep();
    const chiefComplaint = screen.getByText('Chief Complaint');
    const search = screen.getByLabelText(/search for soap template/i);
    const subjective = screen.getByText('Subjective (History)');
    expect(chiefComplaint.compareDocumentPosition(search)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(search.compareDocumentPosition(subjective)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('searches and applies a SOAP template', () => {
    renderSoapStep();
    const search = screen.getByLabelText(/search for soap template/i);
    fireEvent.change(search, { target: { value: 'Ortho' } });
    fireEvent.click(screen.getByText('Orthopaedic exam'));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.soap[0]?.templateId).toBe(
      'tpl-ortho'
    );
  });

  it('signs the SOAP note and shows the stamp', () => {
    const enc = seedAndGet();
    const { rerender } = render(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={enc}
        onRecordVitals={onRecordVitals}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign & Save' }));
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    rerender(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={updated}
        onRecordVitals={onRecordVitals}
      />
    );
    expect(screen.getByText(/Signed by Dr. Tim Apple/)).toBeInTheDocument();
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
  });

  it('shows an offline-signed stamp via the upload path', () => {
    const enc = seedAndGet();
    const { rerender } = render(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={enc}
        onRecordVitals={onRecordVitals}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Signed SOAP' }));
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    rerender(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={updated}
        onRecordVitals={onRecordVitals}
      />
    );
    expect(screen.getByText('Signed Offline')).toBeInTheDocument();
  });

  it('hides editing affordances in view-only mode', () => {
    const enc = { ...seedAndGet(), viewOnly: true };
    renderSoapStep(enc);
    expect(screen.queryByRole('button', { name: /record vitals/i })).not.toBeInTheDocument();
  });

  it('expands a signed note to show read-only SOAP fields', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history text</p>' });
    store.signSoap(APPT, 'Dr Tim', false);
    const updated = store.getEncounter(APPT)!;
    renderSoapStep(updated);
    fireEvent.click(screen.getByRole('button', { name: /view by dr tim/i }));
    // The text appears both in the (read-only) editor and the expanded past note.
    expect(screen.getAllByText('history text').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(APPOINTMENT_REASON).length).toBeGreaterThanOrEqual(2);
  });

  it('invokes the Record Vitals callback from the Objective section', () => {
    onRecordVitals.mockClear();
    renderSoapStep();
    fireEvent.click(screen.getByRole('button', { name: /record vitals/i }));
    expect(onRecordVitals).toHaveBeenCalledTimes(1);
  });

  it('invokes print on the Print to Sign path', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    renderSoapStep();
    fireEvent.click(screen.getByRole('button', { name: 'Print to Sign' }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = renderSoapStep();
    expect(await axe(container)).toHaveNoViolations();
  });
});
