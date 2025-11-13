import type { Types } from 'mongoose'
import ParentCompanionModel, {
    toCompanionParentLink,
    type ParentCompanionDocument,
    type ParentCompanionMongo,
} from '../models/parent-companion'
import type {
    CompanionParentLink,
    ParentCompanionPermissions,
    ParentCompanionRole,
} from '@yosemite-crew/types'

export class ParentCompanionServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'ParentCompanionServiceError'
    }
}

const BASE_PERMISSIONS: ParentCompanionPermissions = {
    assignAsPrimaryParent: false,
    emergencyBasedPermissions: false,
    appointments: false,
    companionProfile: false,
    documents: false,
    expenses: false,
    tasks: false,
    chatWithVet: false,
}

const PRIMARY_PARENT_PERMISSIONS: ParentCompanionPermissions = {
    assignAsPrimaryParent: true,
    emergencyBasedPermissions: true,
    appointments: true,
    companionProfile: true,
    documents: true,
    expenses: true,
    tasks: true,
    chatWithVet: true,
}

const buildPermissions = (
    role: ParentCompanionRole,
    overrides?: Partial<ParentCompanionPermissions>
): ParentCompanionPermissions => {
    const base = role === 'PRIMARY' ? PRIMARY_PARENT_PERMISSIONS : BASE_PERMISSIONS

    return {
        ...base,
        ...overrides,
    }
}

const isDuplicateKeyError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false
    }

    return 'code' in error && (error as { code?: number }).code === 11000
}

interface LinkParentInput {
    parentId: Types.ObjectId
    companionId: Types.ObjectId
    role?: ParentCompanionRole
    permissionsOverride?: Partial<ParentCompanionPermissions>
    invitedByParentId?: Types.ObjectId
}

export const ParentCompanionService = {
    async linkParent({
        parentId,
        companionId,
        role = 'PRIMARY',
        permissionsOverride,
        invitedByParentId,
    }: LinkParentInput): Promise<ParentCompanionDocument> {
        if (!parentId || !companionId) {
            throw new ParentCompanionServiceError('Parent and companion identifiers are required.', 400)
        }

        const permissions = buildPermissions(role, permissionsOverride)
        const payload: ParentCompanionMongo = {
            parentId,
            companionId,
            role,
            status: role === 'PRIMARY' ? 'ACTIVE' : 'PENDING',
            permissions,
            invitedByParentId,
        }

        try {
            const [document] = await ParentCompanionModel.create([payload])
            return document
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                const message =
                    role === 'PRIMARY'
                        ? 'Companion already has an active primary parent.'
                        : 'Parent is already linked to this companion.'
                throw new ParentCompanionServiceError(message, 409)
            }

            throw error
        }
    },

    async activateLink(parentId: Types.ObjectId, companionId: Types.ObjectId): Promise<ParentCompanionDocument | null> {
        const document = await ParentCompanionModel.findOneAndUpdate(
            { parentId, companionId },
            { $set: { status: 'ACTIVE', acceptedAt: new Date() } },
            { new: true, sanitizeFilter: true }
        )

        return document
    },

    async getLinksForCompanion(companionId: Types.ObjectId): Promise<CompanionParentLink[]> {
        const documents = await ParentCompanionModel.find({ companionId }, null, {
            lean: false,
            sanitizeFilter: true,
        })

        return documents.map((document) => toCompanionParentLink(document))
    },

    async getLinksForParent(parentId: Types.ObjectId): Promise<CompanionParentLink[]> {
        const documents = await ParentCompanionModel.find({ parentId }, null, {
            lean: false,
            sanitizeFilter: true,
        })

        return documents.map((document) => toCompanionParentLink(document))
    },

    async getActiveCompanionIdsForParent(parentId: Types.ObjectId): Promise<Types.ObjectId[]> {
        const documents = await ParentCompanionModel.find(
            { parentId, status: { $in: ['ACTIVE', 'PENDING'] } },
            { companionId: 1 }
        )

        return documents.map((doc) => doc.companionId)
    },

    async hasAnyLinks(parentId: Types.ObjectId): Promise<boolean> {
        const count = await ParentCompanionModel.countDocuments({ parentId })
        return count > 0
    },

    async deleteLinksForCompanion(companionId: Types.ObjectId): Promise<number> {
        const result = await ParentCompanionModel.deleteMany({ companionId })
        return result.deletedCount ?? 0
    },

    async deleteLinksForParent(parentId: Types.ObjectId): Promise<number> {
        const result = await ParentCompanionModel.deleteMany({ parentId })
        return result.deletedCount ?? 0
    },

    async ensurePrimaryOwnership(parentId: Types.ObjectId, companionId: Types.ObjectId): Promise<void> {
        const link = await ParentCompanionModel.findOne(
            { parentId, companionId, role: 'PRIMARY', status: 'ACTIVE' },
            null,
            { sanitizeFilter: true }
        )

        if (!link) {
            throw new ParentCompanionServiceError('You are not authorized to modify this companion.', 403)
        }
    },
}
