export type Admission = {
  encounterId: string;
  organisationId: string;
  companionId: string;
  bedUnitId?: string;
  expectedStayDays?: number;
  admittedAt: Date;
  dischargedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
