import {searchController} from "./search.controller"
import {Router} from 'express'
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get('/doctors', asyncHandler(searchController.searchDoctors));

router.get('/specialities', asyncHandler(searchController.getSpecialities));

router.get('/location', asyncHandler(searchController.getLocations));

router.get('/featured', asyncHandler(searchController.getFeaturedDoctor));

export default router;