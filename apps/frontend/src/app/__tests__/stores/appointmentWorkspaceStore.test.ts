import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';

const APPT = 'appt-1';
const getStore = () => useAppointmentWorkspaceStore.getState();

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });

const seed = (mode: 'OUTPATIENT' | 'INPATIENT' = 'OUTPATIENT') => {
  getStore().initEncounter(APPT, mode);
};

describe('appointmentWorkspaceStore', () => {
  beforeEach(reset);

  it('initialises a mock encounter once', () => {
    seed();
    const first = getStore().getEncounter(APPT);
    expect(first?.appointmentId).toBe(APPT);
    expect(first?.mode).toBe('OUTPATIENT');
    // Re-init does not overwrite the existing encounter.
    getStore().initEncounter(APPT, 'INPATIENT');
    expect(getStore().getEncounter(APPT)?.mode).toBe('OUTPATIENT');
  });

  it('seeds inpatient schedule and room for inpatient mode', () => {
    seed('INPATIENT');
    const enc = getStore().getEncounter(APPT);
    expect(enc?.schedule.length).toBeGreaterThan(0);
    expect(enc?.roomId).toBeTruthy();
  });

  it('temporarily switches encounter mode without clearing clinical workspace data', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>preserved</p>' });

    getStore().setEncounterMode(APPT, 'INPATIENT');
    let enc = getStore().getEncounter(APPT)!;
    expect(enc.mode).toBe('INPATIENT');
    expect(enc.consultationType).toBe('Inpatient');
    expect(enc.schedule.length).toBeGreaterThan(0);
    expect(enc.roomId).toBeTruthy();
    expect(enc.soap[0].subjective).toBe('<p>preserved</p>');

    getStore().setEncounterMode(APPT, 'OUTPATIENT');
    enc = getStore().getEncounter(APPT)!;
    expect(enc.mode).toBe('OUTPATIENT');
    expect(enc.consultationType).toBe('Outpatient');
    expect(enc.schedule).toHaveLength(0);
    expect(enc.roomId).toBeUndefined();
    expect(enc.unitId).toBeUndefined();
    expect(enc.soap[0].subjective).toBe('<p>preserved</p>');
  });

  it('navigates steps and side actions', () => {
    getStore().setActiveStep('TREATMENT');
    expect(getStore().activeStep).toBe('TREATMENT');
    getStore().setActiveSideAction('TASKS');
    expect(getStore().activeSideAction).toBe('TASKS');
  });

  it('sets lead, nurse and room/unit', () => {
    seed();
    getStore().setLead(APPT, 'u1', 'Dr A');
    getStore().setNurse(APPT, 'u2', 'Nurse B');
    getStore().setRoomUnit(APPT, 'r1', 'unit-3');
    const enc = getStore().getEncounter(APPT);
    expect(enc?.leadName).toBe('Dr A');
    expect(enc?.nurseName).toBe('Nurse B');
    expect(enc?.roomId).toBe('r1');
    expect(enc?.unitId).toBe('unit-3');
  });

  it('upserts SOAP then signs it, completing the step', () => {
    seed();
    getStore().upsertSoap(APPT, { subjective: '<p>hi</p>' });
    getStore().upsertSoap(APPT, { plan: '<p>plan</p>' });
    let enc = getStore().getEncounter(APPT);
    expect(enc?.soap).toHaveLength(1);
    expect(enc?.soap[0].subjective).toBe('<p>hi</p>');
    expect(enc?.soap[0].plan).toBe('<p>plan</p>');

    getStore().signSoap(APPT, 'Dr Tim', false);
    enc = getStore().getEncounter(APPT);
    expect(enc?.soap[0].signedByName).toBe('Dr Tim');
    expect(enc?.soap[0].status).toBe('COMPLETED');
    expect(enc?.stepStatus.SOAP).toBe('COMPLETED');
  });

  it('applies a SOAP template', () => {
    seed();
    const tpl = getStore().getEncounter(APPT)!.soapTemplates[1];
    getStore().applySoapTemplate(APPT, tpl);
    expect(getStore().getEncounter(APPT)?.soap[0].templateId).toBe(tpl.id);
  });

  it('adds vitals and observations with generated codes', () => {
    seed();
    getStore().addVitals(APPT, { weightLbs: 55, recordedByName: 'Sarah', recordedAt: 'now' });
    getStore().addObservation(APPT, {
      toolKey: 'FGS',
      toolName: 'Feline grimace scale',
      scores: {},
      recordedByName: 'Sarah',
      recordedAt: 'now',
    });
    const enc = getStore().getEncounter(APPT);
    expect(enc?.vitals[0].code).toBe('VT-001');
    expect(enc?.observations[0].code).toBe('OT-001');
  });

  it('adds diagnostic orders and removes queued diagnostic tests', () => {
    seed();
    const initial = getStore().getEncounter(APPT)!;
    getStore().removeDiagnosticTest(APPT, initial.diagnosticTests[0].id);
    expect(getStore().getEncounter(APPT)?.diagnosticTests).toHaveLength(0);

    getStore().addDiagnosticOrder(APPT, { orderCode: 'ABC-123', status: 'SUBMITTED' });
    const enc = getStore().getEncounter(APPT);
    expect(enc?.diagnosticOrders[0].orderCode).toBe('ABC-123');
    expect(enc?.diagnosticOrders[0].status).toBe('SUBMITTED');
    expect(enc?.stepStatus.DIAGNOSTICS).toBe('IN_PROGRESS');
  });

  it('adds, updates and removes line items', () => {
    seed();
    getStore().addLineItem(APPT, {
      refId: 's1',
      kind: 'SERVICE',
      name: 'X-ray',
      qty: 1,
      unitPriceCents: 5000,
      amountCents: 5000,
    });
    const added = getStore().getEncounter(APPT)!.services.at(-1)!;
    getStore().updateLineItem(APPT, added.id, { qty: 3 });
    expect(
      getStore()
        .getEncounter(APPT)
        ?.services.find((s) => s.id === added.id)?.qty
    ).toBe(3);
    getStore().removeLineItem(APPT, added.id);
    expect(
      getStore()
        .getEncounter(APPT)
        ?.services.find((s) => s.id === added.id)
    ).toBeUndefined();
  });

  it('auto-generates inpatient schedule tasks from line items', () => {
    seed('INPATIENT');
    const before = getStore().getEncounter(APPT)!.schedule.length;
    getStore().addLineItem(APPT, {
      refId: 'pkg-1',
      kind: 'PACKAGE',
      name: 'Inpatient care package',
      qty: 1,
      unitPriceCents: 12000,
      amountCents: 12000,
    });
    const enc = getStore().getEncounter(APPT)!;
    expect(enc.schedule).toHaveLength(before + 1);
    expect(enc.schedule.at(-1)?.description).toContain('Inpatient care package');
    expect(enc.schedule.at(-1)?.autoGenerated).toBe(true);
  });

  it('adds, updates and removes prescription items', () => {
    seed();
    getStore().addPrescription(APPT, { medicineName: 'Amox', fulfillment: 'IN_HOUSE' });
    const rx = getStore().getEncounter(APPT)!.prescription.at(-1)!;
    getStore().updatePrescription(APPT, rx.id, { dosage: '10mg' });
    expect(
      getStore()
        .getEncounter(APPT)
        ?.prescription.find((p) => p.id === rx.id)?.dosage
    ).toBe('10mg');
    getStore().removePrescription(APPT, rx.id);
    expect(
      getStore()
        .getEncounter(APPT)
        ?.prescription.find((p) => p.id === rx.id)
    ).toBeUndefined();
  });

  it('auto-generates inpatient medication tasks from prescriptions', () => {
    seed('INPATIENT');
    const before = getStore().getEncounter(APPT)!.schedule.length;
    getStore().addPrescription(APPT, { medicineName: 'Gabapentin', fulfillment: 'IN_HOUSE' });
    const enc = getStore().getEncounter(APPT)!;
    expect(enc.schedule).toHaveLength(before + 1);
    expect(enc.schedule.at(-1)?.category).toBe('Medication');
    expect(enc.schedule.at(-1)?.description).toContain('Gabapentin');
  });

  it('manages schedule tasks', () => {
    seed('INPATIENT');
    getStore().addScheduleTask(APPT, {
      description: 'New task',
      category: 'Care',
      status: 'UPCOMING',
      autoGenerated: false,
    });
    const task = getStore().getEncounter(APPT)!.schedule.at(-1)!;
    getStore().updateScheduleTask(APPT, task.id, { assignedToName: 'Sarah' });
    getStore().setScheduleTaskStatus(APPT, task.id, 'COMPLETED');
    const updated = getStore()
      .getEncounter(APPT)!
      .schedule.find((t) => t.id === task.id)!;
    expect(updated.assignedToName).toBe('Sarah');
    expect(updated.status).toBe('COMPLETED');
  });

  it('sets discharge summary, follow-up and withdraw deposit', () => {
    seed();
    getStore().setDischargeSummary(APPT, '<p>bye</p>');
    getStore().setFollowUp(APPT, '2026-05-01');
    getStore().setWithdrawDeposit(APPT, true);
    const enc = getStore().getEncounter(APPT);
    expect(enc?.dischargeSummary).toBe('<p>bye</p>');
    expect(enc?.followUpAt).toBe('2026-05-01');
    expect(enc?.withdrawDeposit).toBe(true);
  });

  it('adds workspace documents', () => {
    seed();
    const before = getStore().getEncounter(APPT)!.documents.length;
    getStore().addDocument(APPT, {
      createdAt: '2026-05-01T12:00:00Z',
      category: 'Discharge',
      description: 'Signed discharge summary',
      signedByName: 'Dr Tim',
      lastModifiedAt: '2026-05-01T12:00:00Z',
    });
    const enc = getStore().getEncounter(APPT)!;
    expect(enc.documents).toHaveLength(before + 1);
    expect(enc.documents[0].description).toBe('Signed discharge summary');
    expect(enc.documents[0].id).toBeTruthy();
  });

  it('adds and removes invoice line items', () => {
    seed();
    getStore().addInvoiceLineItem(APPT, {
      name: 'Bandage change',
      unitPriceCents: 6500,
      qty: 1,
      grossCents: 6500,
      discountCents: 500,
      amountCents: 6000,
    });
    const added = getStore().getEncounter(APPT)!.invoiceLineItems.at(-1)!;
    expect(added.name).toBe('Bandage change');
    getStore().removeInvoiceLineItem(APPT, added.id);
    expect(
      getStore()
        .getEncounter(APPT)
        ?.invoiceLineItems.find((item) => item.id === added.id)
    ).toBeUndefined();
  });

  it('toggles ready-for-billing with a stamp and clears it', () => {
    seed();
    getStore().toggleReadyForBilling(APPT, { id: 'u1', name: 'Dr Tim' });
    let enc = getStore().getEncounter(APPT);
    expect(enc?.readyForBilling.value).toBe(true);
    expect(enc?.readyForBilling.byName).toBe('Dr Tim');
    expect(enc?.readyForBilling.at).toBeTruthy();
    getStore().toggleReadyForBilling(APPT, { id: 'u1', name: 'Dr Tim' });
    enc = getStore().getEncounter(APPT);
    expect(enc?.readyForBilling.value).toBe(false);
    expect(enc?.readyForBilling.byName).toBeUndefined();
  });

  it('toggles ready-for-discharge with a stamp', () => {
    seed();
    getStore().toggleReadyForDischarge(APPT, { id: 'u2', name: 'Sarah' });
    expect(getStore().getEncounter(APPT)?.readyForDischarge.byName).toBe('Sarah');
  });

  it('sets step status', () => {
    seed();
    getStore().setStepStatus(APPT, 'DIAGNOSTICS', 'COMPLETED');
    expect(getStore().getEncounter(APPT)?.stepStatus.DIAGNOSTICS).toBe('COMPLETED');
  });

  it('ignores mutations for unknown appointments', () => {
    getStore().setLead('missing', 'u', 'n');
    expect(getStore().getEncounter('missing')).toBeUndefined();
  });
});
