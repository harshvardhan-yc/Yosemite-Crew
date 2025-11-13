import { ParentController } from '../../src/controllers/app/parent.controller'
import { ParentService, ParentServiceError } from '../../src/services/parent.service'
import { CompanionService } from '../../src/services/companion.service'
import { ParentCompanionService } from '../../src/services/parent-companion.service'

jest.mock('../../src/services/parent.service', () => {
    const actual = jest.requireActual('../../src/services/parent.service')
    return {
        ...actual,
        ParentService: {
            create: jest.fn(),
            getById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findDocumentByIdentifier: jest.fn(),
            findDocumentByUserId: jest.fn(),
        },
    }
})

jest.mock('../../src/services/companion.service', () => {
    const actual = jest.requireActual('../../src/services/companion.service')
    return {
        ...actual,
        CompanionService: {
            listByParent: jest.fn(),
        },
    }
})

jest.mock('../../src/services/parent-companion.service', () => {
    const actual = jest.requireActual('../../src/services/parent-companion.service')
    return {
        ...actual,
        ParentCompanionService: {
            hasAnyLinks: jest.fn(),
            deleteLinksForParent: jest.fn(),
        },
    }
})

const mockedParentService = ParentService as unknown as {
    findDocumentByIdentifier: jest.Mock
    delete: jest.Mock
}

const mockedCompanionService = CompanionService as unknown as {
    listByParent: jest.Mock
}

const mockedParentCompanionService = ParentCompanionService as unknown as {
    hasAnyLinks: jest.Mock
    deleteLinksForParent: jest.Mock
}

const createResponse = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
    }
    return res
}

describe('ParentController', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('listCompanions', () => {
        it('requires auth', async () => {
            const req = { params: { id: 'parent-1' } } as any
            const res = createResponse()

            await ParentController.listCompanions(req, res as any)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized.' })
        })

        it('returns 404 when parent not found', async () => {
            const req = { params: { id: 'parent-1' }, userId: 'user-1' } as any
            const res = createResponse()
            mockedParentService.findDocumentByIdentifier.mockResolvedValueOnce(null)

            await ParentController.listCompanions(req, res as any)

            expect(res.status).toHaveBeenCalledWith(404)
            expect(res.json).toHaveBeenCalledWith({ message: 'Parent not found.' })
        })

        it('returns 403 when user does not own parent', async () => {
            const req = { params: { id: 'parent-1' }, userId: 'user-1' } as any
            const res = createResponse()
            mockedParentService.findDocumentByIdentifier.mockResolvedValueOnce({ userId: 'other', _id: 'mongo-id' })

            await ParentController.listCompanions(req, res as any)

            expect(res.status).toHaveBeenCalledWith(403)
            expect(res.json).toHaveBeenCalledWith({ message: 'You are not allowed to access these companions.' })
        })

        it('returns companion responses when authorized', async () => {
            const req = { params: { id: 'parent-1' }, userId: 'user-1' } as any
            const res = createResponse()
            const parentDocument = { userId: 'user-1', _id: 'mongo-id' }
            mockedParentService.findDocumentByIdentifier.mockResolvedValueOnce(parentDocument)
            const responsePayload = [{ resourceType: 'Patient', id: 'cmp-1' }]
            mockedCompanionService.listByParent.mockResolvedValueOnce({ responses: responsePayload })

            await ParentController.listCompanions(req, res as any)

            expect(mockedCompanionService.listByParent).toHaveBeenCalledWith(parentDocument._id)
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith(responsePayload)
        })
    })

    describe('delete', () => {
        it('requires auth', async () => {
            const req = { params: { id: 'parent-1' } } as any
            const res = createResponse()

            await ParentController.delete(req, res as any)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized.' })
        })

        it('rejects when companions still linked', async () => {
            const req = { params: { id: 'parent-1' }, userId: 'user-1' } as any
            const res = createResponse()
            const parentDocument = { userId: 'user-1', _id: 'mongo-id' }
            mockedParentService.findDocumentByIdentifier.mockResolvedValueOnce(parentDocument)
            mockedParentCompanionService.hasAnyLinks.mockResolvedValueOnce(true)

            await ParentController.delete(req, res as any)

            expect(res.status).toHaveBeenCalledWith(409)
            expect(res.json).toHaveBeenCalledWith({
                message: 'Remove associated companions before deleting this parent.',
            })
            expect(mockedParentService.delete).not.toHaveBeenCalled()
        })

        it('deletes parent when authorized', async () => {
            const req = { params: { id: 'parent-1' }, userId: 'user-1' } as any
            const res = createResponse()
            const parentDocument = { userId: 'user-1', _id: 'mongo-id' }
            mockedParentService.findDocumentByIdentifier.mockResolvedValueOnce(parentDocument)
            mockedParentCompanionService.hasAnyLinks.mockResolvedValueOnce(false)
            mockedParentService.delete.mockResolvedValueOnce({ _id: 'parent-1' })

            await ParentController.delete(req, res as any)

            expect(mockedParentService.delete).toHaveBeenCalledWith('parent-1', { userId: 'user-1' })
            expect(mockedParentCompanionService.deleteLinksForParent).toHaveBeenCalledWith(parentDocument._id)
            expect(res.status).toHaveBeenCalledWith(204)
            expect(res.send).toHaveBeenCalled()
        })

        it('maps ParentServiceError to response', async () => {
            const req = { params: { id: 'parent-1' }, userId: 'user-1' } as any
            const res = createResponse()
            mockedParentService.findDocumentByIdentifier.mockImplementationOnce(() => {
                throw new ParentServiceError('boom', 400)
            })

            await ParentController.delete(req, res as any)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ message: 'boom' })
        })
    })
})
