import { getData, postData } from '@/app/services/axios';

export type FormAssignmentDTO = Record<string, unknown>;
export type CreateFormAssignmentBody = Record<string, unknown>;

export const createAppointmentFormAssignment = async (
  organisationId: string,
  appointmentId: string,
  body: CreateFormAssignmentBody
) => {
  const res = await postData<FormAssignmentDTO>(
    `/v1/forms/organisations/${organisationId}/appointments/${appointmentId}/assignments`,
    body
  );
  return res.data;
};

export const listAppointmentFormAssignments = async (
  organisationId: string,
  appointmentId: string
) => {
  const res = await getData<FormAssignmentDTO[]>(
    `/v1/forms/organisations/${organisationId}/appointments/${appointmentId}/assignments`
  );
  return res.data ?? [];
};

export const listCompanionFormAssignments = async (organisationId: string, companionId: string) => {
  const res = await getData<FormAssignmentDTO[]>(
    `/v1/forms/organisations/${organisationId}/companions/${companionId}/assignments`
  );
  return res.data ?? [];
};

export const resendFormAssignment = async (organisationId: string, assignmentId: string) => {
  const res = await postData<FormAssignmentDTO>(
    `/v1/forms/organisations/${organisationId}/assignments/${assignmentId}/$resend`
  );
  return res.data;
};

export const cancelFormAssignment = async (organisationId: string, assignmentId: string) => {
  const res = await postData<FormAssignmentDTO>(
    `/v1/forms/organisations/${organisationId}/assignments/${assignmentId}/$cancel`
  );
  return res.data;
};
