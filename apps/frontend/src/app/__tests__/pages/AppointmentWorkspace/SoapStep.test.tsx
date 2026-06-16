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
const onSaveAndNext = jest.fn();

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });

const seedAndGet = () => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'OUTPATIENT');
  useAppointmentWorkspaceStore.setState((state) => ({
    encountersById: {
      ...state.encountersById,
      [APPT]: {
        ...state.encountersById[APPT],
        leadName: 'Dr. Tim Apple',
        soapTemplates: [
          { id: 'tpl-default', name: 'Default SOAP', isDefault: true },
          { id: 'tpl-ortho', name: 'Orthopaedic exam', serviceId: 'svc-ortho' },
        ],
      },
    },
  }));
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
        onSaveAndNext={onSaveAndNext}
      />
    );

  it('renders the four SOAP sections and chief complaint', () => {
    renderSoapStep();
    expect(screen.getByText('Chief Complaint')).toBeInTheDocument();
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

  it('records the SOAP note, clears the form, and advances on Save & Next', () => {
    onSaveAndNext.mockClear();
    seedAndGet();
    // A draft note must exist before it can be signed/recorded.
    useAppointmentWorkspaceStore.getState().upsertSoap(APPT, { subjective: '<p>history</p>' });
    const enc = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    const { rerender } = render(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={enc}
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    // The note is signed (recorded) and the parent advance callback fires.
    expect(onSaveAndNext).toHaveBeenCalledTimes(1);
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    expect(updated.soap[0]?.status).toBe('COMPLETED');
    rerender(
      <SoapStep
        appointmentId={APPT}
        appointmentReason={APPOINTMENT_REASON}
        encounter={updated}
        onRecordVitals={onRecordVitals}
        onSaveAndNext={onSaveAndNext}
      />
    );
    // The signed note moves to history; the form clears and stays editable so a
    // new SOAP can be started.
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText(/By Dr\. Tim Apple/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print to Sign' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & Next' })).not.toBeDisabled();
  });

  it('starts a fresh draft after a note is signed', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history</p>' });
    store.signSoap(APPT, 'Dr Tim', false);
    // A new edit after signing creates a brand-new draft rather than mutating the
    // signed note.
    store.upsertSoap(APPT, { subjective: '<p>new visit</p>' });
    const soap = store.getEncounter(APPT)!.soap;
    expect(soap.filter((n) => n.status === 'COMPLETED')).toHaveLength(1);
    expect(soap.find((n) => n.status !== 'COMPLETED')?.subjective).toBe('<p>new visit</p>');
  });

  it('keeps Print to Sign and Save & Next available after signing', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history</p>' });
    store.signSoap(APPT, 'Dr Tim', false);
    renderSoapStep(store.getEncounter(APPT)!);
    expect(screen.getByRole('button', { name: 'Print to Sign' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & Next' })).toBeInTheDocument();
  });

  it('shows an offline status chip in history for offline-signed notes', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history</p>' });
    store.signSoap(APPT, 'Dr Tim', true);
    renderSoapStep(store.getEncounter(APPT)!);
    expect(screen.getByText('Signed offline')).toBeInTheDocument();
  });

  it('shows only complaint context and past notes when the step is view-only', () => {
    seedAndGet();
    useAppointmentWorkspaceStore.getState().upsertSoap(APPT, { subjective: '<p>history</p>' });
    useAppointmentWorkspaceStore.getState().signSoap(APPT, 'Dr Tim', false);
    const enc = { ...useAppointmentWorkspaceStore.getState().getEncounter(APPT)!, viewOnly: true };
    renderSoapStep(enc);
    expect(screen.queryByLabelText(/search for soap template/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Subjective (History)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save & Next' })).not.toBeInTheDocument();
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText(/By Dr Tim/)).toBeInTheDocument();
  });

  it('hides editing affordances in view-only mode', () => {
    const enc = { ...seedAndGet(), viewOnly: true };
    renderSoapStep(enc);
    expect(screen.queryByRole('button', { name: /record vitals/i })).not.toBeInTheDocument();
  });

  it('expands a signed note in history to show read-only SOAP fields', () => {
    seedAndGet();
    const store = useAppointmentWorkspaceStore.getState();
    store.upsertSoap(APPT, { subjective: '<p>history text</p>' });
    store.signSoap(APPT, 'Dr Tim', false);
    const updated = store.getEncounter(APPT)!;
    renderSoapStep(updated);
    fireEvent.click(screen.getByRole('button', { name: /view soap note by dr tim/i }));
    // The signed note's text shows in the expanded history read-out (the form
    // itself has cleared, so the text appears once).
    expect(screen.getByText('history text')).toBeInTheDocument();
    expect(screen.getAllByText(APPOINTMENT_REASON).length).toBeGreaterThanOrEqual(1);
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

  it('advances from the SOAP step when Save & Next is clicked', () => {
    onSaveAndNext.mockClear();
    renderSoapStep();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    expect(onSaveAndNext).toHaveBeenCalledTimes(1);
  });

  it('falls back to Unknown signer and omits date/time when not recorded', () => {
    const enc = {
      ...seedAndGet(),
      soap: [
        {
          id: 'soap-old',
          chiefComplaint: '',
          subjective: '<p>legacy</p>',
          objective: '',
          assessment: '',
          plan: '',
          status: 'COMPLETED' as const,
          createdAt: '',
        },
      ],
    };
    renderSoapStep(enc);
    expect(screen.getByText(/By Unknown/)).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = renderSoapStep();
    expect(await axe(container)).toHaveNoViolations();
  });
});
