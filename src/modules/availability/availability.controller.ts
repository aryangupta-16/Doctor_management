import { Request, Response,NextFunction } from 'express';
import AvailabilityService from './availability.service';
import {SlotStatus} from "@prisma/client"
import prisma from "../../prisma/client"

export default class AvailabilityController {
  // GET /doctors/:doctorId/availability
  static async createSchedule(req: Request, res: Response) {
    try {
      const userId = req.user && req?.user.sub;
      const doctor = await prisma.doctor.findUnique({
        where: {userId: userId},
        select: {
            id: true,
            isVerified: true
        }
      })

      const doctorId = doctor?.id;
      const isVerified = doctor?.isVerified;

      if(!doctorId){
        throw new Error("only doctors can create schedules")
      }

      const {dayOfWeek,startTime,endTime} = req.body;

      const result = await AvailabilityService.createWeeklySchedule(doctorId,{
        dayOfWeek,startTime,endTime
      })

      return res.status(201).json({ success: true, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // POST /doctors/:doctorId/availability
  static async getSchedule(req: Request, res: Response) {
      try {
      const userId = req.user && req?.user.sub;
      const doctor = await prisma.doctor.findUnique({
        where: {userId: userId},
        select: {
            id: true,
            isVerified: true
        }
      })

      const doctorId = doctor?.id;

      if(!doctorId){
        throw new Error("only doctors can get schedules")
      }


      const result = await AvailabilityService.getWeeklySchedule(doctorId)

      return res.status(201).json({ success: true, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // PUT /doctors/:doctorId/availability/:id
  static async updateSchedule(req: Request, res: Response) {
      try {
      const userId = req.user && req?.user.sub;
      const doctor = await prisma.doctor.findUnique({
        where: {userId: userId},
        select: {
            id: true,
            isVerified: true
        }
      })

      const doctorId = doctor?.id;

      const {scheduleId} = req.params
      const isVerified = doctor?.isVerified;

      if(!doctorId){
        throw new Error("only doctors can update schedules")
      }

      const {dayOfWeek,startTime,endTime,isActive} = req.body;

      const result = await AvailabilityService.updateWeeklySchedule(doctorId,scheduleId,{
        dayOfWeek,startTime,endTime,isActive
      })

      return res.status(201).json({ success: true, result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  
  // POST /slots/availability
  static async deleteSchedule(req: Request, res: Response) {
      try {
          const userId = req.user && req?.user.sub;
          const doctor = await prisma.doctor.findUnique({
              where: {userId: userId},
              select: {
                  id: true,
                  isVerified: true
                }
            })
            
            const doctorId = doctor?.id;
            
            const {scheduleId} = req.params
            const isVerified = doctor?.isVerified;
            
            if(!doctorId){
                throw new Error("only doctors can update schedules")
            }
            
            
            const result = await AvailabilityService.deleteWeeklySchedule(doctorId,scheduleId)
            
            return res.status(201).json({ success: true, result });
        } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    
    // POST /doctors/:doctorId/slots/generate
    static async generateSlots(req: Request, res: Response) {
      try {
        const userId = req.user && req?.user.sub;
        const doctor = await prisma.doctor.findUnique({
          where: {userId: userId},
          select: {
              id: true,
              isVerified: true
          }
        })
  
        const doctorId = doctor?.id;
        const isVerified = doctor?.isVerified;
  
        if(!doctorId){
          throw new Error("only doctors can update schedules")
        }
  
        const {startDate,endDate,slotDuration} = req.body;
  
        const result = await AvailabilityService.generateSlots(doctorId,{
          startDate,endDate,slotDuration
        })
  
        return res.status(201).json({ success: true, result });
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }
    
  static async getSlots(req:Request,res:Response){
    try{

        const userId = req.user && req.user.sub;
        
        const doctor = await prisma.doctor.findUnique({
            where:{userId:userId},
            select:{
                id: true,
            }
        })
        
        const doctorId = doctor?.id
        
        if(!doctorId){
            throw new Error("Only doctors can view slots")
        }
        
        const {date,status,startDate,endDate} = req.query
        
        const result = await AvailabilityService.getSlots(doctorId,{
            date: date as string,
            status,
            startDate,
            endDate
        })
        
        res.status(201).json(result);
    }catch(error:any){
        return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async blockSlots(req:Request, res:Response){
    try{

        const userId = req.user && req.user.sub;
        
        const doctor = await prisma.doctor.findUnique({
            where:{userId:userId},
            select:{
                id: true,
            }
        })
        
        const doctorId = doctor?.id
        
        if(!doctorId){
            throw new Error("Only doctors can block slots")
        }
        
        const {slotIds, reason} = req.body
        
        const result = await AvailabilityService.blockSlots(doctorId,{
            slotIds,
            reason
        })
        
        res.status(201).json(result);
    }catch(error:any){
        return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getDoctorSlots(req:Request, res:Response){

    try{
    const {doctorId} = req.params;
    const {date,startDate,endDate,limit} = req.query;

    const result = await AvailabilityService.getDoctorAvailableSlots(doctorId,{
        date,startDate,endDate,limit
    })

     res.status(201).json(result);
    }catch(error:any){
        return res.status(400).json({ success: false, message: error.message });
    }
}
}
