import {
  buildWorkspaceHref,
  buildWorkspaceHrefForIntent,
  canEnterAppointmentWorkspace,
  getWorkspaceBlockedMessage,
  getNextStep,
  isPastLockWindow,
  resolveWorkspaceStepForIntent,
  resolveEncounterMode,
  resolveLandingStep,
  richTextIsEmpty,
} from '@/app/lib/appointmentWorkspace';
import { buildEmptyEncounter } from '@/app/features/appointments/services/workspaceInitialData';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';

const base = (): AppointmentEncounter => buildEmptyEncounter('a1', 'OUTPATIENT');

describe('appointmentWorkspace lib', () => {
  it('builds workspace hrefs with and without a step', () => {
    expect(buildWorkspaceHref('a 1')).toBe('/appointments/a%201/workspace');
    expect(buildWorkspaceHref('a1', 'INVOICE')).toBe('/appointments/a1/workspace?step=INVOICE');
  });

  it('maps appointment view intents to workspace steps', () => {
    expect(resolveWorkspaceStepForIntent({ label: 'prescription', subLabel: 'subjective' })).toBe(
      'SOAP'
    );
    expect(resolveWorkspaceStepForIntent({ label: 'care', subLabel: 'forms' })).toBe('SOAP');
    expect(resolveWorkspaceStepForIntent({ label: 'labs', subLabel: 'idexx-labs' })).toBe(
      'DIAGNOSTICS'
    );
    expect(resolveWorkspaceStepForIntent({ label: 'finance', subLabel: 'summary' })).toBe(
      'INVOICE'
    );
    expect(resolveWorkspaceStepForIntent({ label: 'tasks', subLabel: 'task' })).toBe('TREATMENT');
    expect(resolveWorkspaceStepForIntent({ label: 'info', subLabel: 'appointment' })).toBe(
      'SUMMARY'
    );
    expect(resolveWorkspaceStepForIntent(null)).toBeUndefined();
  });

  it('builds workspace hrefs from appointment view intents', () => {
    expect(buildWorkspaceHrefForIntent('a1', { label: 'labs', subLabel: 'idexx-labs' })).toBe(
      '/appointments/a1/workspace?step=DIAGNOSTICS'
    );
    expect(buildWorkspaceHrefForIntent('a1')).toBe('/appointments/a1/workspace');
  });

  it('gates workspace entry by appointment status', () => {
    expect(canEnterAppointmentWorkspace('UPCOMING')).toBe(true);
    expect(canEnterAppointmentWorkspace('CHECKED_IN')).toBe(true);
    expect(canEnterAppointmentWorkspace('IN_PROGRESS')).toBe(true);
    expect(canEnterAppointmentWorkspace('COMPLETED')).toBe(true);
    expect(canEnterAppointmentWorkspace('REQUESTED')).toBe(false);
    expect(canEnterAppointmentWorkspace('NO_PAYMENT')).toBe(false);
    expect(canEnterAppointmentWorkspace('CANCELLED')).toBe(false);
    expect(canEnterAppointmentWorkspace('NO_SHOW')).toBe(false);
    expect(getWorkspaceBlockedMessage('NO_SHOW')).toBe(
      'No show appointments cannot be opened in the clinical workspace.'
    );
  });

  it('resolves encounter mode from room presence', () => {
    expect(resolveEncounterMode({ room: { id: 'r1', name: 'Room 1' } })).toBe('INPATIENT');
    expect(resolveEncounterMode({ room: undefined })).toBe('OUTPATIENT');
  });

  it('gets the next step and null on the last', () => {
    expect(getNextStep('SOAP')).toBe('DIAGNOSTICS');
    expect(getNextStep('INVOICE')).toBe('SUMMARY');
    expect(getNextStep('SUMMARY')).toBeNull();
  });

  it('resolves landing step from encounter progress', () => {
    const enc = base();
    expect(resolveLandingStep(enc)).toBe('SOAP');

    enc.stepStatus.SOAP = 'COMPLETED';
    expect(resolveLandingStep(enc)).toBe('DIAGNOSTICS');

    enc.stepStatus.DIAGNOSTICS = 'COMPLETED';
    expect(resolveLandingStep(enc)).toBe('TREATMENT');

    enc.stepStatus.TREATMENT = 'COMPLETED';
    expect(resolveLandingStep(enc)).toBe('INVOICE');

    enc.readyForBilling = { value: true };
    expect(resolveLandingStep(enc)).toBe('INVOICE');

    enc.readyForDischarge = { value: true };
    expect(resolveLandingStep(enc)).toBe('SUMMARY');

    enc.viewOnly = true;
    expect(resolveLandingStep(enc)).toBe('SUMMARY');
  });

  it('detects the lock window', () => {
    const now = new Date('2026-05-02T12:00:00Z').getTime();
    expect(isPastLockWindow('2026-04-30T12:00:00Z', 'OUTPATIENT', now)).toBe(true);
    expect(isPastLockWindow('2026-05-02T06:00:00Z', 'OUTPATIENT', now)).toBe(false);
    expect(isPastLockWindow(undefined, 'OUTPATIENT', now)).toBe(false);
    expect(isPastLockWindow('not-a-date', 'INPATIENT', now)).toBe(false);
  });

  it('honours an explicit override-hours window', () => {
    const now = new Date('2026-05-02T12:00:00Z').getTime();
    // 8h before now: locked at the default 24h? no. With a 6h override it locks.
    const start = '2026-05-02T04:00:00Z';
    expect(isPastLockWindow(start, 'OUTPATIENT', now)).toBe(false);
    expect(isPastLockWindow(start, 'OUTPATIENT', now, 6)).toBe(true);
    expect(isPastLockWindow(start, 'OUTPATIENT', now, 12)).toBe(false);
    // A non-positive / non-finite override falls back to the default window.
    expect(isPastLockWindow('2026-04-30T12:00:00Z', 'OUTPATIENT', now, 0)).toBe(true);
    expect(isPastLockWindow('2026-04-30T12:00:00Z', 'OUTPATIENT', now, Number.NaN)).toBe(true);
  });

  it('detects empty rich text', () => {
    expect(richTextIsEmpty(undefined)).toBe(true);
    expect(richTextIsEmpty('')).toBe(true);
    expect(richTextIsEmpty('<p></p>')).toBe(true);
    expect(richTextIsEmpty('<p>&nbsp;</p>')).toBe(true);
    expect(richTextIsEmpty('<p>hello</p>')).toBe(false);
  });
});
