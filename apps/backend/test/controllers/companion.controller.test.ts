import { CompanionController } from '../../src/controllers/app/companion.controller'
import { CompanionService, CompanionServiceError } from '../../src/services/companion.service'
import { ParentService, ParentServiceError } from '../../src/services/parent.service'

jest.mock('../../src/services/companion.service', () => {
    const actual = jest.requireActual('../../src/services/companion.service')
    return {
        ...actual,
        CompanionService: {
            create: jest.fn(),
            getById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
})

jest.mock('../../src/services/parent.service', () => {
    const actual = jest.requireActual('../../src/services/parent.service')
    return {
        ...actual,
        ParentService: {
            create: jest.fn(),
            getById: jest.fn(),
            update: jest.fn(),
            findDocumentByUserId: jest.fn(),
        },
        ParentServiceError: actual.ParentServiceError,
    }
})

const mockedCompanionService = CompanionService as unknown as {
    create: jest.Mock
    delete: jest.Mock
}

const mockedParentService = ParentService as unknown as {
    findDocumentByUserId: jest.Mock
}

const createResponse = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
    }
    return res
}

describe('CompanionController', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('create', () => {
        const basePayload = {
            resourceType: 'Patient',
            name: [{ text: 'Companion' }],
            gender: 'male',
            birthDate: '2020-01-01',
            animal: { species: { text: 'Dog' } },
        }

        it('rejects unauthenticated requests', async () => {
            const req = { body: basePayload } as any
            const res = createResponse()

            await CompanionController.create(req, res as any)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized.' })
            expect(mockedCompanionService.create).not.toHaveBeenCalled()
        })

        it('returns 404 when parent profile missing', async () => {
            const req = { body: basePayload, userId: 'user-1' } as any
            const res = createResponse()
            mockedParentService.findDocumentByUserId.mockResolvedValueOnce(null)

            await CompanionController.create(req, res as any)

            expect(res.status).toHaveBeenCalledWith(404)
            expect(res.json).toHaveBeenCalledWith({ message: 'Parent profile not found for current user.' })
            expect(mockedCompanionService.create).not.toHaveBeenCalled()
        })

        it('creates companion when parent exists', async () => {
            const req = { body: basePayload, userId: 'user-1' } as any
            const res = createResponse()
            const parentDocument = { _id: 'parent-mongo-id' }
            mockedParentService.findDocumentByUserId.mockResolvedValueOnce(parentDocument)
            const responsePayload = { resourceType: 'Patient', id: '123' }
            mockedCompanionService.create.mockResolvedValueOnce({ response: responsePayload })

            await CompanionController.create(req, res as any)

            expect(mockedCompanionService.create).toHaveBeenCalledWith(basePayload, {
                parentMongoId: parentDocument._id,
            })
            expect(res.status).toHaveBeenCalledWith(201)
            expect(res.json).toHaveBeenCalledWith(responsePayload)
        })

        it('maps ParentServiceError to HTTP response', async () => {
            const req = { body: basePayload, userId: 'user-1' } as any
            const res = createResponse()
            mockedParentService.findDocumentByUserId.mockRejectedValueOnce(new ParentServiceError('boom', 400))

            await CompanionController.create(req, res as any)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ message: 'boom' })
        })

        it('maps CompanionServiceError to HTTP response', async () => {
            const req = { body: basePayload, userId: 'user-1' } as any
            const res = createResponse()
            const parentDocument = { _id: 'parent-mongo-id' }
            mockedParentService.findDocumentByUserId.mockResolvedValueOnce(parentDocument)
            mockedCompanionService.create.mockRejectedValueOnce(new CompanionServiceError('bad', 422))

            await CompanionController.create(req, res as any)

            expect(res.status).toHaveBeenCalledWith(422)
            expect(res.json).toHaveBeenCalledWith({ message: 'bad' })
        })
    })

    describe('delete', () => {
        it('requires authentication', async () => {
            const req = { params: { id: 'cmp-1' } } as any
            const res = createResponse()

            await CompanionController.delete(req, res as any)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized.' })
            expect(mockedCompanionService.delete).not.toHaveBeenCalled()
        })

        it('returns 404 when parent missing', async () => {
            const req = { params: { id: 'cmp-1' }, userId: 'user-1' } as any
            const res = createResponse()
            mockedParentService.findDocumentByUserId.mockResolvedValueOnce(null)

            await CompanionController.delete(req, res as any)

            expect(res.status).toHaveBeenCalledWith(404)
            expect(res.json).toHaveBeenCalledWith({ message: 'Parent profile not found for current user.' })
            expect(mockedCompanionService.delete).not.toHaveBeenCalled()
        })

        it('deletes companion when authorized', async () => {
            const req = { params: { id: 'cmp-1' }, userId: 'user-1' } as any
            const res = createResponse()
            const parentDocument = { _id: 'parent-mongo-id' }
            mockedParentService.findDocumentByUserId.mockResolvedValueOnce(parentDocument)
            mockedCompanionService.delete.mockResolvedValueOnce(undefined)

            await CompanionController.delete(req, res as any)

            expect(mockedCompanionService.delete).toHaveBeenCalledWith('cmp-1', {
                parentMongoId: parentDocument._id,
            })
            expect(res.status).toHaveBeenCalledWith(204)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('maps CompanionServiceError to HTTP response', async () => {
            const req = { params: { id: 'cmp-1' }, userId: 'user-1' } as any
            const res = createResponse()
            const parentDocument = { _id: 'parent-mongo-id' }
            mockedParentService.findDocumentByUserId.mockResolvedValueOnce(parentDocument)
            mockedCompanionService.delete.mockRejectedValueOnce(new CompanionServiceError('cant', 403))

            await CompanionController.delete(req, res as any)

            expect(res.status).toHaveBeenCalledWith(403)
            expect(res.json).toHaveBeenCalledWith({ message: 'cant' })
        })
    })
})
