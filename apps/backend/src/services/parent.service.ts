import { Types } from 'mongoose'
import ParentModel, { ParentDocument, type ParentMongo } from '../models/parent'
import {
    fromParentRequestDTO,
    toParentResponseDTO,
    type ParentRequestDTO,
    type ParentDTOAttributesType,
    type Parent,
} from '@yosemite-crew/types'

type ParentAddress = Parent['address']
type ParentServiceContext = {
    userId: string
}
type PersistableParentAttributes = Omit<ParentMongo, 'userId'>

export class ParentServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'ParentServiceError'
    }
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const pruneUndefined = <T>(value: T): T => {
    if (Array.isArray(value)) {
        const arrayValue = value as unknown[]
        const cleaned: unknown[] = arrayValue
            .map((item) => pruneUndefined(item))
            .filter((item) => item !== undefined)
        return cleaned as unknown as T
    }

    if (value && typeof value === 'object') {
        if (value instanceof Date) {
            return value
        }

        const record = value as Record<string, unknown>
        const cleanedRecord: Record<string, unknown> = {}

        for (const [key, entryValue] of Object.entries(record)) {
            const next = pruneUndefined(entryValue)

            if (next !== undefined) {
                cleanedRecord[key] = next
            }
        }

        return cleanedRecord as unknown as T
    }

    return value
}

const requireSafeString = (value: unknown, fieldName: string): string => {
    if (!isNonEmptyString(value)) {
        throw new ParentServiceError(`${fieldName} is required.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        throw new ParentServiceError(`${fieldName} cannot be empty.`, 400)
    }

    if (trimmed.includes('$')) {
        throw new ParentServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const optionalSafeString = (value: unknown, fieldName: string): string | undefined => {
    if (value == null) {
        return undefined
    }

    if (typeof value !== 'string') {
        throw new ParentServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        return undefined
    }

    if (trimmed.includes('$')) {
        throw new ParentServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const ensureSafeIdentifier = (value: unknown): string | undefined => {
    const identifier = optionalSafeString(value, 'Identifier')

    if (!identifier) {
        return undefined
    }

    if (!Types.ObjectId.isValid(identifier) && !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
        throw new ParentServiceError('Invalid identifier format.', 400)
    }

    return identifier
}

const sanitizeParentAttributes = (dto: ParentDTOAttributesType): PersistableParentAttributes => {
    const firstName = requireSafeString(dto.firstName, 'Parent first name')

    if (typeof dto.age !== 'number') {
        throw new ParentServiceError('Parent age is required.', 400)
    }

    const addressDto = dto.address

    if (!addressDto) {
        throw new ParentServiceError('Parent address is required.', 400)
    }

    const address: ParentMongo['address'] = {
        addressLine: optionalSafeString(addressDto.addressLine, 'Parent address line'),
        country: optionalSafeString(addressDto.country, 'Parent country'),
        city: optionalSafeString(addressDto.city, 'Parent city'),
        state: optionalSafeString(addressDto.state, 'Parent state'),
        postalCode: optionalSafeString(addressDto.postalCode, 'Parent postal code'),
        latitude: addressDto.latitude,
        longitude: addressDto.longitude,
    }

    return {
        fhirId: ensureSafeIdentifier(dto._id),
        firstName,
        lastName: optionalSafeString(dto.lastName, 'Parent last name'),
        age: dto.age,
        address,
        phoneNumber: optionalSafeString(dto.phoneNumber, 'Parent phone number'),
        profileImageUrl: optionalSafeString(dto.profileImageUrl, 'Parent profile image URL'),
        birthDate: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    }
}

const isAddressComplete = (address: ParentAddress): boolean => {
    const requiredFields: Array<keyof ParentAddress> = ['addressLine', 'city', 'state', 'postalCode', 'country']

    return requiredFields.every((field) => isNonEmptyString(address[field]))
}

const requireAuthenticatedUserId = (context?: ParentServiceContext): string => {
    if (!context?.userId || !isNonEmptyString(context.userId)) {
        throw new ParentServiceError('Authenticated parent context is required.', 401)
    }

    return context.userId.trim()
}

const applyOwnershipFilter = <T extends Record<string, unknown>>(
    query: T,
    context?: ParentServiceContext
): T & { userId?: string } => {
    if (!context?.userId) {
        return query
    }

    return {
        ...query,
        userId: context.userId,
    }
}

const determineProfileCompletion = (parent: Parent): boolean => {
    const { firstName, age, phoneNumber, address } = parent

    return (
        isNonEmptyString(firstName) &&
        typeof age === 'number' &&
        age > 0 &&
        isAddressComplete(address) &&
        isNonEmptyString(phoneNumber)
    )
}

const buildParentDomain = (document: ParentDocument): Parent => {
    const { _id, fhirId, ...rest } = document.toObject({ virtuals: false }) as ParentMongo & {
        _id: Types.ObjectId
    }

    const address: ParentAddress = {
        addressLine: rest.address?.addressLine,
        country: rest.address?.country,
        city: rest.address?.city,
        state: rest.address?.state,
        postalCode: rest.address?.postalCode,
        latitude: rest.address?.latitude,
        longitude: rest.address?.longitude,
    }

    const parent: Parent = {
        _id: fhirId ?? _id.toString(),
        userId: rest.userId,
        firstName: rest.firstName,
        lastName: rest.lastName,
        age: rest.age,
        address,
        phoneNumber: rest.phoneNumber,
        profileImageUrl: rest.profileImageUrl,
        birthDate: rest.birthDate,
    }

    parent.isProfileComplete = determineProfileCompletion(parent)

    return parent
}

const createPersistableFromFHIR = (payload: ParentRequestDTO): { persistable: PersistableParentAttributes } => {
    if (payload?.resourceType !== 'RelatedPerson') {
        throw new ParentServiceError('Invalid payload. Expected FHIR RelatedPerson resource.', 400)
    }

    const attributes = fromParentRequestDTO(payload)
    const persistable = pruneUndefined(sanitizeParentAttributes(attributes))

    return { persistable }
}

const resolveIdQuery = (id: string) => {
    const safeId = ensureSafeIdentifier(id)

    if (!safeId) {
        throw new ParentServiceError('Invalid parent identifier.', 400)
    }

    return Types.ObjectId.isValid(safeId) ? { _id: safeId } : { fhirId: safeId }
}

export const ParentService = {
    async create(payload: ParentRequestDTO, context: ParentServiceContext) {
        const userId = requireAuthenticatedUserId(context)
        payload.id = userId
        const { persistable } = createPersistableFromFHIR(payload)

        const existing = await ParentModel.findOne({ userId }, null, { sanitizeFilter: true })

        if (existing) {
            throw new ParentServiceError('Parent profile already exists for this user.', 409)
        }

        const document = await ParentModel.create({
            ...persistable,
            userId
        })
        const parent = buildParentDomain(document)
        const response = toParentResponseDTO(parent)

        return {
            response,
            isProfileComplete: parent.isProfileComplete ?? false,
        }
    },

    async getById(id: string, context?: ParentServiceContext) {
        const query = applyOwnershipFilter(resolveIdQuery(id), context)
        const document = await ParentModel.findOne(query, null, { sanitizeFilter: true })

        if (!document) {
            return null
        }

        const parent = buildParentDomain(document)
        return {
            response: toParentResponseDTO(parent),
            isProfileComplete: parent.isProfileComplete ?? false,
        }
    },

    async update(id: string, payload: ParentRequestDTO, context?: ParentServiceContext) {
        const { persistable } = createPersistableFromFHIR(payload)
        const document = await ParentModel.findOneAndUpdate(
            applyOwnershipFilter(resolveIdQuery(id), context),
            { $set: persistable },
            { new: true, sanitizeFilter: true }
        )

        if (!document) {
            return null
        }

        const parent = buildParentDomain(document)
        return {
            response: toParentResponseDTO(parent),
            isProfileComplete: parent.isProfileComplete ?? false,
        }
    },

    async delete(id: string, context: ParentServiceContext) {
        const document = await ParentModel.findOneAndDelete(
            applyOwnershipFilter(resolveIdQuery(id), context),
            { sanitizeFilter: true }
        )

        if (!document) {
            return null
        }

        return buildParentDomain(document)
    },

    async findDocumentByUserId(userId: string) {
        if (!isNonEmptyString(userId)) {
            throw new ParentServiceError('User identifier is required to load parent.', 400)
        }

        return ParentModel.findOne({ userId: userId.trim() }, null, { sanitizeFilter: true })
    },

    async findDocumentByIdentifier(id: string) {
        return ParentModel.findOne(resolveIdQuery(id), null, { sanitizeFilter: true })
    },
}
