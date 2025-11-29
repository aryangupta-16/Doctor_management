import { searchService } from "./search.service"
import { Request, Response } from "express"

export const searchController = {

    searchDoctors: async (req: Request, res: Response) => {
        const {
            speciality,
            city,
            state,
            minRating,
            maxFee,
            minFee,
            experience,
            language,
            gender,
            hasAvailability,
            date,
            page,
            limit,
            sortBy,
            sortOrder,
        } = req.query;

        const filters = {
            speciality: speciality as string | undefined,
            city: city as string | undefined,
            state: state as string | undefined,
            minRating: minRating ? parseFloat(minRating as string) : undefined,
            maxFee: maxFee ? parseFloat(maxFee as string) : undefined,
            minFee: minFee ? parseFloat(minFee as string) : undefined,
            experience: experience ? parseInt(experience as string, 10) : undefined,
            language: language as string | undefined,
            gender: gender as string | undefined,
            hasAvailability: hasAvailability
                ? (hasAvailability === "true")
                : undefined,
            date: date ? new Date(date as string) : undefined,
            page: page ? parseInt(page as string, 10) : 1,        // default page = 1
            limit: limit ? parseInt(limit as string, 10) : 10,    // default limit = 10
            sortBy: sortBy as string | undefined,
            sortOrder: sortOrder as "asc" | "desc" | undefined,
        };
        const result = await searchService.searchDoctors(filters);
        return res.status(201).json({ success: true, result });
    },

    getSpecialities : async(req:Request, res:Response) => {
        const result = await searchService.getSpecialities();
        return res.status(201).json({ success: true, result });
    },

    getLocations : async(req:Request, res:Response) => {
        const result = await searchService.getLocations();
        return res.status(201).json({ success: true, result });
    },

    getFeaturedDoctor : async(req:Request, res:Response) => {
        const {limit} = req.query;
        const result = await searchService.getFeaturedDoctors(limit ? parseInt(limit as string):undefined);
        return res.status(201).json({ success: true, result });
    }
}