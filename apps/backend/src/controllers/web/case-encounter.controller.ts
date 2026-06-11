import { Request, Response } from "express";
import { z } from "zod";
import {
  fromCaseRequestDTO,
  fromEncounterRequestDTO,
  toCaseResponseDTO,
  toEncounterResponseDTO,
  type CaseRequestDTO,
  type EncounterRequestDTO,
} from "@yosemite-crew/types";
import {
  CaseEncounterService,
  CaseEncounterServiceError,
} from "src/services/case-encounter.service";
import logger from "src/utils/logger";

const caseResourceSchema = z
  .object({ resourceType: z.literal("EpisodeOfCare") })
  .passthrough();
const encounterResourceSchema = z
  .object({ resourceType: z.literal("Encounter") })
  .passthrough();

const caseListQuerySchema = z.object({
  organization: z.string().trim().optional(),
  patient: z.string().trim().optional(),
  parent: z.string().trim().optional(),
  status: z.string().trim().optional(),
  appointmentKind: z.enum(["OUTPATIENT", "INPATIENT"]).optional(),
});

const encounterListQuerySchema = z.object({
  organization: z.string().trim().optional(),
  episodeofcare: z.string().trim().optional(),
  patient: z.string().trim().optional(),
  parent: z.string().trim().optional(),
  status: z.string().trim().optional(),
  appointmentKind: z.enum(["OUTPATIENT", "INPATIENT"]).optional(),
});
const dischargeEncounterSchema = z
  .object({
    resourceType: z.literal("Parameters").optional(),
    parameter: z
      .array(
        z.object({
          name: z.string(),
          valueDateTime: z.string().datetime().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();
const assignUnitSchema = z
  .object({
    resourceType: z.literal("Parameters").optional(),
    parameter: z
      .array(
        z.object({
          name: z.string(),
          valueString: z.string().optional(),
          valueDateTime: z.string().datetime().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

const unitAssignmentResource = (assignment: {
  id: string;
  encounterId: string;
  admissionId: string;
  unitId: string;
  assignedAt: Date;
  releasedAt?: Date;
  assignedBy?: string;
  reason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  name: "assignment",
  part: [
    { name: "id", valueString: assignment.id },
    { name: "encounterId", valueString: assignment.encounterId },
    { name: "admissionId", valueString: assignment.admissionId },
    { name: "unitId", valueString: assignment.unitId },
    { name: "assignedAt", valueDateTime: assignment.assignedAt.toISOString() },
    ...(assignment.releasedAt
      ? [
          {
            name: "releasedAt",
            valueDateTime: assignment.releasedAt.toISOString(),
          },
        ]
      : []),
    ...(assignment.assignedBy
      ? [{ name: "assignedBy", valueString: assignment.assignedBy }]
      : []),
    ...(assignment.reason
      ? [{ name: "reason", valueString: assignment.reason }]
      : []),
    ...(assignment.createdAt
      ? [
          {
            name: "createdAt",
            valueDateTime: assignment.createdAt.toISOString(),
          },
        ]
      : []),
    ...(assignment.updatedAt
      ? [
          {
            name: "updatedAt",
            valueDateTime: assignment.updatedAt.toISOString(),
          },
        ]
      : []),
  ],
});

const parseReferenceId = (value?: string, prefix?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return prefix ? trimmed.replace(new RegExp(`^${prefix}/`), "") : trimmed;
};

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof CaseEncounterServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

export const CaseController = {
  create: async (
    req: Request<unknown, unknown, CaseRequestDTO>,
    res: Response,
  ) => {
    try {
      const dto = caseResourceSchema.parse(
        req.body,
      ) as unknown as CaseRequestDTO;
      const created = await CaseEncounterService.createCase(
        fromCaseRequestDTO(dto),
      );
      return res.status(201).json(toCaseResponseDTO(created));
    } catch (error) {
      return handleError(res, error, "Failed to create case.");
    }
  },

  update: async (
    req: Request<{ id: string }, unknown, CaseRequestDTO>,
    res: Response,
  ) => {
    try {
      const dto = caseResourceSchema.parse(
        req.body,
      ) as unknown as CaseRequestDTO;
      const updated = await CaseEncounterService.updateCase(
        req.params.id,
        fromCaseRequestDTO(dto),
      );
      return res.status(200).json(toCaseResponseDTO(updated));
    } catch (error) {
      return handleError(res, error, "Failed to update case.");
    }
  },

  getById: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const value = await CaseEncounterService.getCaseById(req.params.id);
      return res.status(200).json(toCaseResponseDTO(value));
    } catch (error) {
      return handleError(res, error, "Failed to fetch case.");
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      const query = caseListQuerySchema.parse(req.query);
      const values = await CaseEncounterService.listCases({
        organisationId: parseReferenceId(query.organization, "Organization"),
        companionId: parseReferenceId(query.patient, "Patient"),
        parentId: parseReferenceId(query.parent, "RelatedPerson"),
        status: query.status as never,
        appointmentKind: query.appointmentKind,
      });
      return res.status(200).json({
        resourceType: "Bundle",
        type: "searchset",
        total: values.length,
        entry: values.map((value) => ({
          resource: toCaseResponseDTO(value),
        })),
      });
    } catch (error) {
      return handleError(res, error, "Failed to list cases.");
    }
  },
};

export const EncounterController = {
  create: async (
    req: Request<unknown, unknown, EncounterRequestDTO>,
    res: Response,
  ) => {
    try {
      const dto = encounterResourceSchema.parse(
        req.body,
      ) as unknown as EncounterRequestDTO;
      const created = await CaseEncounterService.createEncounter(
        fromEncounterRequestDTO(dto),
      );
      return res.status(201).json(toEncounterResponseDTO(created));
    } catch (error) {
      return handleError(res, error, "Failed to create encounter.");
    }
  },

  update: async (
    req: Request<{ id: string }, unknown, EncounterRequestDTO>,
    res: Response,
  ) => {
    try {
      const dto = encounterResourceSchema.parse(
        req.body,
      ) as unknown as EncounterRequestDTO;
      const updated = await CaseEncounterService.updateEncounter(
        req.params.id,
        fromEncounterRequestDTO(dto),
      );
      return res.status(200).json(toEncounterResponseDTO(updated));
    } catch (error) {
      return handleError(res, error, "Failed to update encounter.");
    }
  },

  discharge: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const payload = dischargeEncounterSchema.parse(req.body ?? {});
      const dischargedAt = payload.parameter?.find(
        (parameter) => parameter.name === "dischargedAt",
      )?.valueDateTime;
      const periodEnd = payload.parameter?.find(
        (parameter) => parameter.name === "periodEnd",
      )?.valueDateTime;

      const updated = await CaseEncounterService.dischargeEncounter(
        req.params.id,
        {
          dischargedAt: dischargedAt ? new Date(dischargedAt) : undefined,
          periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        },
      );

      return res.status(200).json(toEncounterResponseDTO(updated));
    } catch (error) {
      return handleError(res, error, "Failed to discharge encounter.");
    }
  },

  assignUnit: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const payload = assignUnitSchema.parse(req.body ?? {});
      const unitId = payload.parameter?.find(
        (parameter) => parameter.name === "unitId",
      )?.valueString;
      const assignedBy = payload.parameter?.find(
        (parameter) => parameter.name === "assignedBy",
      )?.valueString;
      const reason = payload.parameter?.find(
        (parameter) => parameter.name === "reason",
      )?.valueString;
      const assignedAt = payload.parameter?.find(
        (parameter) => parameter.name === "assignedAt",
      )?.valueDateTime;

      const updated = await CaseEncounterService.assignUnit(req.params.id, {
        unitId: unitId ?? "",
        assignedBy,
        reason,
        assignedAt: assignedAt ? new Date(assignedAt) : undefined,
      });

      return res.status(200).json(toEncounterResponseDTO(updated));
    } catch (error) {
      return handleError(res, error, "Failed to assign unit.");
    }
  },

  listUnitAssignments: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const assignments = await CaseEncounterService.listUnitAssignments({
        encounterId: req.params.id,
      });

      return res.status(200).json({
        resourceType: "Parameters",
        parameter: assignments.map(unitAssignmentResource),
      });
    } catch (error) {
      return handleError(res, error, "Failed to list unit assignments.");
    }
  },

  getById: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const value = await CaseEncounterService.getEncounterById(req.params.id);
      return res.status(200).json(toEncounterResponseDTO(value));
    } catch (error) {
      return handleError(res, error, "Failed to fetch encounter.");
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      const query = encounterListQuerySchema.parse(req.query);
      const values = await CaseEncounterService.listEncounters({
        organisationId: parseReferenceId(query.organization, "Organization"),
        caseId: parseReferenceId(query.episodeofcare, "EpisodeOfCare"),
        companionId: parseReferenceId(query.patient, "Patient"),
        parentId: parseReferenceId(query.parent, "RelatedPerson"),
        status: query.status as never,
        appointmentKind: query.appointmentKind,
      });
      return res.status(200).json({
        resourceType: "Bundle",
        type: "searchset",
        total: values.length,
        entry: values.map((value) => ({
          resource: toEncounterResponseDTO(value),
        })),
      });
    } catch (error) {
      return handleError(res, error, "Failed to list encounters.");
    }
  },
};
