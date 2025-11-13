import { Router } from 'express'
import { CompanionController } from '../controllers/app/companion.controller'
import authorizeCognito from '../middlewares/auth'

const router = Router()

router.use(authorizeCognito)

router.post('/', CompanionController.create)
router.get('/:id', CompanionController.getById)
router.put('/:id', CompanionController.update)
router.delete('/:id', CompanionController.delete)

export default router
