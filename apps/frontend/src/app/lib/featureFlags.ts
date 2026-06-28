export const isAppointmentRevampEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_APPOINTMENT_REVAMP === 'true';

export const isCompanionRevampEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_COMPANION_REVAMP === 'true';
