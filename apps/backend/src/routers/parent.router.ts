import { Router } from 'express'
import { ParentController } from '../controllers/app/parent.controller'
import authorizeCognito from '../middlewares/auth'

const router = Router()

router.use(authorizeCognito)

router.post('/', ParentController.create)
router.get('/:id', ParentController.getById)
router.put('/:id', ParentController.update)
router.get('/:id/companions', ParentController.listCompanions)
router.delete('/:id', ParentController.delete)

export default router
