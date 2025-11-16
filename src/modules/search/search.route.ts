import {searchController} from "./search.controller"
import {Router} from 'express'

const router = Router();

router.get('/doctors', searchController.searchDoctors);

router.get('/specialities',searchController.getSpecialities);

router.get('/location',searchController.getLocations);

router.get('/featured',searchController.getFeaturedDoctor);

export default router