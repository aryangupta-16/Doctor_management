import { searchService } from "./search.service"
import { Request, Response } from "express"

export const searchController = {

    searchDoctors: async (req: Request, res: Response) => {
        try {
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
            const result = searchService.searchDoctors(filters);

            return res.status(201).json({ success: true, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
    },

    getSpecialities : async(req:Request, res:Response) => {
        try{
            const result = searchService.getSpecialities();

            return res.status(201).json({ success: true, result });
    } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
    }
    },

    getLocations : async(req:Request, res:Response) => {
        try{
            const result = searchService.getLocations();

            return res.status(201).json({ success: true, result });
    } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
    }
    },

    getFeaturedDoctor : async(req:Request, res:Response) => {
        try{
            const {limit} = req.query;
            const result = searchService.getFeaturedDoctors(limit ? parseInt(limit as string):undefined);
            return res.status(201).json({ success: true, result });
    } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
    }
    }
}