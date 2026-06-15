import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import CompanionOrganisationModel, {
  CompanionOrganisationDocument,
} from "../models/companion-organisation";
import { assertSafeString } from "src/utils/sanitize";
import ParentCompanionModel from "src/models/parent-companion";
import CompanionModel from "../models/companion";
import { ParentModel } from "src/models/parent";
import {
  toFHIR as toFHIRCompanion,
  toFHIRFromPrisma as toFHIRCompanionFromPrisma,
} from "./companion.service";
import {
  toFHIR as toFHIRParent,
  toFHIRFromPrisma as toFHIRParentFromPrisma,
} from "./parent.service";
import { AuditTrailService } from "./audit-trail.service";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import {
  PatientOrganisationRole as PrismaPatientOrganisationRole,
  PatientOrganisationStatus as PrismaPatientOrganisationStatus,
  OrganisationType,
} from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

type BusinessType = "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";

export class CompanionOrganisationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompanionOrganisationServiceError";
  }
}

const ensureObjectId = (value: string | Types.ObjectId, field: string) => {
  // Reject objects or unexpected input
  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (typeof value !== "string") {
    throw new CompanionOrganisationServiceError(`Invalid ${field}`, 400);
  }

  // Prevent NoSQL injection attempts: disallow $ and .
  if (value.includes("$") || value.includes(".")) {
    throw new CompanionOrganisationServiceError(`Invalid ${field}`, 400);
  }

  // Ensure format is strictly 24 hex chars
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    throw new CompanionOrganisationServiceError(`Invalid ${field}`, 400);
  }

  return new Types.ObjectId(value);
};

const toPrismaCompanionOrganisationData = (
  doc: CompanionOrganisationDocument,
) => {
  const obj = doc.toObject() as CompanionOrganisationDocument & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    patientId: obj.patientId.toString(),
    organisationId: obj.organisationId
      ? obj.organisationId.toString()
      : undefined,
    linkedByParentId: obj.linkedByParentId
      ? obj.linkedByParentId.toString()
      : undefined,
    linkedByPmsUserId: obj.linkedByPmsUserId ?? undefined,
    organisationType: obj.organisationType as OrganisationType,
    role: obj.role as PrismaPatientOrganisationRole,
    status: obj.status as PrismaPatientOrganisationStatus,
    invitedViaEmail: obj.invitedViaEmail ?? undefined,
    organisationName: obj.organisationName ?? undefined,
    organisationPlacesId: obj.organisationPlacesId ?? undefined,
    inviteToken: obj.inviteToken ?? undefined,
    acceptedAt: obj.acceptedAt ?? undefined,
    rejectedAt: obj.rejectedAt ?? undefined,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncCompanionOrganisationToPostgres = async (
  doc: CompanionOrganisationDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaCompanionOrganisationData(doc);
    await prisma.patientOrganisation.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("PatientOrganisation", err);
  }
};

export const CompanionOrganisationService = {
  async linkByParent({
    parentId,
    patientId,
    organisationId,
    organisationType,
  }: {
    parentId: Types.ObjectId | string;
    patientId: Types.ObjectId | string;
    organisationId: Types.ObjectId | string;
    organisationType: BusinessType;
  }): Promise<CompanionOrganisationDocument> {
    const parent = ensureObjectId(parentId, "parentId");
    const companion = ensureObjectId(patientId, "patientId");
    const org = ensureObjectId(organisationId, "organisationId");

    // Prevent duplicate active links
    const existing = await CompanionOrganisationModel.findOne({
      patientId: companion,
      organisationId: org,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existing) return existing;

    const link = await CompanionOrganisationModel.create({
      patientId: companion,
      organisationId: org,
      linkedByParentId: parent,
      organisationType,
      role: "ORGANISATION",
      status: "ACTIVE",
    });

    await syncCompanionOrganisationToPostgres(link);

    await AuditTrailService.recordSafely({
      organisationId: org.toString(),
      patientId: companion.toString(),
      eventType: "PATIENT_ORG_LINK_CREATED",
      actorType: "PARENT",
      actorId: parent.toString(),
      entityType: "PATIENT_ORGANISATION",
      entityId: link._id.toString(),
      metadata: {
        organisationType,
        status: link.status,
      },
    });

    return link;
  },

  async linkByPmsUser({
    pmsUserId,
    patientId,
    organisationId,
    organisationType,
  }: {
    pmsUserId: string;
    patientId: Types.ObjectId | string;
    organisationId: Types.ObjectId | string;
    organisationType: BusinessType;
  }): Promise<CompanionOrganisationDocument> {
    const companion = ensureObjectId(patientId, "patientId");
    const org = ensureObjectId(organisationId, "organisationId");

    const existing = await CompanionOrganisationModel.findOne({
      patientId: companion,
      organisationId: org,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existing) return existing;

    const link = await CompanionOrganisationModel.create({
      patientId: companion,
      organisationId: org,
      linkedByPmsUserId: pmsUserId,
      organisationType,
      role: "ORGANISATION",
      status: "PENDING",
    });

    await syncCompanionOrganisationToPostgres(link);

    await AuditTrailService.recordSafely({
      organisationId: org.toString(),
      patientId: companion.toString(),
      eventType: "PATIENT_ORG_LINK_REQUESTED",
      actorType: "PMS_USER",
      actorId: pmsUserId,
      entityType: "PATIENT_ORGANISATION",
      entityId: link._id.toString(),
      metadata: {
        organisationType,
        status: link.status,
      },
    });

    return link;
  },

  async sendInvite({
    parentId,
    patientId,
    organisationType,
    email,
    name,
    placesId,
  }: {
    parentId: Types.ObjectId | string;
    patientId: Types.ObjectId | string;
    organisationType: BusinessType;
    email?: string | null;
    name?: string | null;
    placesId?: string | null;
  }): Promise<CompanionOrganisationDocument> {
    if (!email && !name) {
      throw new CompanionOrganisationServiceError(
        "Email required or Name",
        400,
      );
    }

    const parent = ensureObjectId(parentId, "parentId");
    const companion = ensureObjectId(patientId, "patientId");

    const token = randomUUID();

    const link = await CompanionOrganisationModel.create({
      patientId: companion,
      linkedByParentId: parent,
      invitedViaEmail: email,
      organisationName: name,
      organisationPlacesId: placesId,
      inviteToken: token,
      organisationId: null,
      organisationType,
      role: "ORGANISATION",
      status: "PENDING",
    });

    await syncCompanionOrganisationToPostgres(link);
    return link;
  },

  // Validate Invite Token
  async validateInvite(token: string) {
    if (!token)
      throw new CompanionOrganisationServiceError("Invite token missing", 400);

    if (isReadFromPostgres()) {
      const invite = await prisma.patientOrganisation.findFirst({
        where: {
          inviteToken: token,
          status: "PENDING",
        },
      });
      if (!invite) {
        throw new CompanionOrganisationServiceError(
          "Invalid or expired invite",
          404,
        );
      }
      return { ...invite, _id: invite.id };
    }

    const invite = await CompanionOrganisationModel.findOne({
      inviteToken: token,
      status: "PENDING",
    });

    if (!invite)
      throw new CompanionOrganisationServiceError(
        "Invalid or expired invite",
        404,
      );

    return invite;
  },

  // Accept Invite
  async acceptInvite({
    token,
    organisationId,
  }: {
    token: string;
    organisationId: Types.ObjectId | string;
  }): Promise<CompanionOrganisationDocument> {
    const org = ensureObjectId(organisationId, "organisationId");
    token = assertSafeString(token, "token");
    const invite = await CompanionOrganisationModel.findOne({
      inviteToken: token,
      status: "PENDING",
    });

    if (!invite)
      throw new CompanionOrganisationServiceError("Invalid invite token", 404);

    invite.organisationId = org;
    invite.acceptedAt = new Date();
    invite.status = "ACTIVE";
    invite.inviteToken = null;

    await invite.save();

    await syncCompanionOrganisationToPostgres(invite);

    await AuditTrailService.recordSafely({
      organisationId: org.toString(),
      patientId: invite.patientId.toString(),
      eventType: "PATIENT_ORG_INVITE_ACCEPTED",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: invite._id.toString(),
      metadata: {
        organisationType: invite.organisationType,
        status: invite.status,
      },
    });

    return invite;
  },

  async rejectInvite({
    token,
    organisationId,
  }: {
    token: string;
    organisationId: Types.ObjectId | string;
  }): Promise<void> {
    const org = ensureObjectId(organisationId, "organisationId");
    token = assertSafeString(token, "token");
    const invite = await CompanionOrganisationModel.findOne({
      inviteToken: token,
      status: "PENDING",
    });

    if (!invite)
      throw new CompanionOrganisationServiceError("Invalid invite token", 404);

    invite.organisationId = org;
    invite.rejectedAt = new Date();
    invite.status = "REVOKED";
    invite.inviteToken = null;

    await invite.save();

    await syncCompanionOrganisationToPostgres(invite);

    await AuditTrailService.recordSafely({
      organisationId: org.toString(),
      patientId: invite.patientId.toString(),
      eventType: "PATIENT_ORG_INVITE_REJECTED",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: invite._id.toString(),
      metadata: {
        organisationType: invite.organisationType,
        status: invite.status,
      },
    });
  },

  async linkOnCompanionCreatedByPms({
    patientId,
    organisationId,
    pmsUserId,
    organisationType,
  }: {
    patientId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    pmsUserId: string;
    organisationType: BusinessType;
  }) {
    return this.linkByPmsUser({
      pmsUserId,
      patientId,
      organisationId,
      organisationType,
    });
  },

  async linkOnAppointmentBooked({
    patientId,
    organisationId,
    organisationType,
  }: {
    patientId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    organisationType: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  }) {
    const companion = ensureObjectId(patientId, "patientId");
    const org = ensureObjectId(organisationId, "organisationId");

    const existing = await CompanionOrganisationModel.findOne({
      patientId: companion,
      organisationId: org,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existing) return existing;

    const link = await CompanionOrganisationModel.create({
      patientId: companion,
      organisationId: org,
      organisationType,
      status: "ACTIVE",
      role: "ORGANISATION",
    });

    await syncCompanionOrganisationToPostgres(link);

    await AuditTrailService.recordSafely({
      organisationId: org.toString(),
      patientId: companion.toString(),
      eventType: "PATIENT_ORG_LINK_AUTO",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: link._id.toString(),
      metadata: {
        organisationType,
        status: link.status,
      },
    });

    return link;
  },

  async revokeLink(linkId: string | Types.ObjectId) {
    const id = ensureObjectId(linkId, "linkId");

    const link = await CompanionOrganisationModel.findByIdAndDelete(id);

    if (!link)
      throw new CompanionOrganisationServiceError("Link not found", 404);

    if (shouldDualWrite) {
      try {
        await prisma.patientOrganisation.deleteMany({
          where: { id: link._id.toString() },
        });
      } catch (err) {
        handleDualWriteError("PatientOrganisation delete", err);
      }
    }

    await AuditTrailService.recordSafely({
      organisationId: link.organisationId?.toString() ?? "",
      patientId: link.patientId.toString(),
      eventType: "PATIENT_ORG_LINK_REVOKED",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: link._id.toString(),
      metadata: {
        organisationType: link.organisationType,
        status: link.status,
      },
    });

    return link;
  },

  async parentApproveLink(parentId: Types.ObjectId, linkId: string) {
    linkId = assertSafeString(linkId, "linkId");
    const id = ensureObjectId(linkId, "linkId");
    const link = await CompanionOrganisationModel.findOne({
      _id: id,
      linkedByParentId: null, // PMS created it
      status: "PENDING",
    });

    if (!link) {
      throw new CompanionOrganisationServiceError(
        "Pending link not found.",
        404,
      );
    }

    link.status = "ACTIVE";
    link.acceptedAt = new Date();
    link.linkedByParentId = parentId;

    await link.save();

    await syncCompanionOrganisationToPostgres(link);

    await AuditTrailService.recordSafely({
      organisationId: link.organisationId?.toString() ?? "",
      patientId: link.patientId.toString(),
      eventType: "PATIENT_ORG_LINK_APPROVED",
      actorType: "PARENT",
      actorId: parentId.toString(),
      entityType: "PATIENT_ORGANISATION",
      entityId: link._id.toString(),
      metadata: {
        organisationType: link.organisationType,
        status: link.status,
      },
    });

    return link;
  },

  async parentRejectLink(parentId: Types.ObjectId, linkId: string) {
    linkId = assertSafeString(linkId, "linkId");
    const id = ensureObjectId(linkId, "linkId");
    const link = await CompanionOrganisationModel.findOne({
      _id: id,
      status: "PENDING",
    });

    if (!link) {
      throw new CompanionOrganisationServiceError(
        "Pending link not found.",
        404,
      );
    }

    link.status = "REVOKED";
    link.acceptedAt = null;
    link.linkedByParentId = parentId;

    await link.save();

    await syncCompanionOrganisationToPostgres(link);

    await AuditTrailService.recordSafely({
      organisationId: link.organisationId?.toString() ?? "",
      patientId: link.patientId.toString(),
      eventType: "PATIENT_ORG_LINK_REJECTED",
      actorType: "PARENT",
      actorId: parentId.toString(),
      entityType: "PATIENT_ORGANISATION",
      entityId: link._id.toString(),
      metadata: {
        organisationType: link.organisationType,
        status: link.status,
      },
    });

    return link;
  },

  async getLinksForCompanion(patientId: string | Types.ObjectId) {
    const id = ensureObjectId(patientId, "patientId");
    if (isReadFromPostgres()) {
      const links = await prisma.patientOrganisation.findMany({
        where: { patientId: id.toString() },
      });
      return links.map((link) => ({ ...link, _id: link.id }));
    }
    return CompanionOrganisationModel.find({ patientId: id });
  },

  async getLinksForCompanionByOrganisationTye(
    patientId: string | Types.ObjectId,
    type: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER",
  ) {
    patientId = assertSafeString(patientId, "patientId");
    const id = ensureObjectId(patientId, "patientId");
    if (isReadFromPostgres()) {
      const links = await prisma.patientOrganisation.findMany({
        where: {
          patientId: id.toString(),
          organisationType: type,
          OR: [
            { status: "ACTIVE" },
            { status: "PENDING", organisationId: { not: null } },
          ],
        },
      });

      const parentLink = await prisma.parentPatient.findFirst({
        where: { patientId: id.toString(), role: "PRIMARY" },
      });

      const companion = await prisma.patient.findUnique({
        where: { id: id.toString() },
      });

      const parent = parentLink
        ? await prisma.parent.findUnique({
            where: { id: parentLink.parentId },
          })
        : null;

      return {
        links: links.map((link) => ({ ...link, _id: link.id })),
        parentName: parent
          ? [parent.firstName, parent.lastName].filter(Boolean).join(" ")
          : undefined,
        email: parent?.email,
        companionName: companion?.name,
        phoneNumber: parent?.phoneNumber ?? undefined,
      };
    }

    const links = await CompanionOrganisationModel.find({
      patientId: id,
      organisationType: type,
      $or: [
        { status: "ACTIVE" },
        {
          status: "PENDING",
          organisationId: { $ne: null }, // <-- key line
        },
      ],
    }).populate(
      "organisationId",
      "name imageURL phoneNo address googlePlacesId",
    );

    const parentComapnionLink = await ParentCompanionModel.findOne({
      patientId: id,
      role: "PRIMARY",
    }).exec();

    const companion = await CompanionModel.findById(id);
    const parent = await ParentModel.findById(parentComapnionLink?.parentId);

    return {
      links,
      parentName: parent?.firstName + " " + parent?.lastName,
      email: parent?.email,
      companionName: companion?.name,
      phoneNumber: parent?.phoneNumber,
    };
  },

  async getLinksForOrganisation(organisationId: string | Types.ObjectId) {
    const id = ensureObjectId(organisationId, "organisationId");

    if (isReadFromPostgres()) {
      const links = await prisma.patientOrganisation.findMany({
        where: {
          organisationId: id.toString(),
          status: { in: ["ACTIVE", "PENDING"] },
        },
      });

      const companionIds = Array.from(new Set(links.map((l) => l.patientId)));
      const companions = await prisma.patient.findMany({
        where: { id: { in: companionIds } },
      });
      const companionMap = new Map(companions.map((c) => [c.id, c]));

      const parentLinks = await prisma.parentPatient.findMany({
        where: {
          patientId: { in: companionIds },
          role: "PRIMARY",
          status: "ACTIVE",
        },
      });
      const parentIds = Array.from(new Set(parentLinks.map((l) => l.parentId)));
      const parents = await prisma.parent.findMany({
        where: { id: { in: parentIds } },
      });
      const parentMap = new Map(parents.map((p) => [p.id, p]));
      const parentByCompanion = new Map(
        parentLinks.map((l) => [l.patientId, l.parentId]),
      );

      const results = links.map((link) => {
        const companion = companionMap.get(link.patientId);
        const parentId = parentByCompanion.get(link.patientId);
        const parent = parentId ? parentMap.get(parentId) : null;

        return {
          linkId: link.id,
          organisationId: link.organisationId ?? undefined,
          organisationType: link.organisationType,
          status: link.status,
          companion: companion ? toFHIRCompanionFromPrisma(companion) : null,
          parent: parent ? toFHIRParentFromPrisma(parent) : null,
        };
      });

      return results.filter(Boolean);
    }

    const links = await CompanionOrganisationModel.find({
      organisationId: id,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    const results = await Promise.all(
      links.map(async (link) => {
        // 1️⃣ Fetch companion
        const companion = await CompanionModel.findById(link.patientId);
        if (!companion) {
          // orphaned link → skip
          return null;
        }

        // 2️⃣ Fetch primary parent
        const parentLink = await ParentCompanionModel.findOne({
          patientId: companion._id,
          role: "PRIMARY",
          status: "ACTIVE",
        });

        const parent = parentLink
          ? await ParentModel.findById(parentLink.parentId)
          : null;

        return {
          linkId: link._id.toString(),
          organisationId: link.organisationId?.toString(),
          organisationType: link.organisationType,
          status: link.status,

          // ✅ SAFE
          companion: toFHIRCompanion(companion),
          parent: parent ? toFHIRParent(parent) : null,
        };
      }),
    );

    // Remove nulls caused by orphaned links
    return results.filter(Boolean);
  },
};
