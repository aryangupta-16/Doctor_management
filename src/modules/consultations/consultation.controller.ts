import { Request, Response } from 'express';
import ConsultationService from './consultation.service';
import { ConsultationStatus } from '@prisma/client';

export default class ConsultationController {

  static async bookConsultation(req:Request, res:Response){
    try {
      const patientId = (req as any).user.sub;

      const {slotId, consultationType, chiefComplaint, symptoms} = req.body

      if(!slotId){
        throw new Error('slot id is required');
      }
      const result = await ConsultationService.bookConsultation(patientId,{
        slotId, consultationType, chiefComplaint, symptoms
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
  
  static async getMyConsultations(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const role = (req as any).user.roles;
    
      const {status,page,limit} = req.query;

      const result = await ConsultationService.getMyConsultations(userId, role, {
        status: status as ConsultationStatus,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getConsultationById(req:Request, res:Response){
    try {
      const {id} = req.params
      const userId = (req as any).user.sub;
      const role = (req as any).user.roles;

      if(!id){
        throw new Error("consultation id is required");
      }

      const result = await ConsultationService.getConsultationById(id, userId, role);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async cancelConsultation(req:Request, res:Response){
    try {
      const {id} = req.params
      const userId = (req as any).user.sub;
      const role = (req as any).user.roles;

      const {reason} = req.body;

      if(!id){
        throw new Error("Consultation id is required");
      }

      if(!reason){
        throw new Error("Cancellation reason is required");
      }

      const cancelledBy = role

      const result = await ConsultationService.cancelConsultation(id,userId,role,{
        reason, cancelledBy
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async rescheduleConsultation(req:Request, res:Response){
    try {
      const {id} = req.params
      const userId = (req as any).user.sub;
      const role = (req as any).user.roles;

      const {newSlotId, reason} = req.body;

      if(!id){
        throw new Error("Consultation id is required");
      }

      if(!newSlotId){
        throw new Error("New slot Id is required");
      }

      if(!reason){
        throw new Error("Cancellation reason is required");
      }
      const result = await ConsultationService.rescheduleConsultation(id,userId,role,{
        newSlotId, reason
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async startConsultation(req:Request, res:Response){
    try {
      const {id} = req.params
      const doctorUserId = (req as any).user.sub;

      if(!id){
        throw new Error("consultation id is required");
      }

      const result = await ConsultationService.startConsultation(id,doctorUserId);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async completeConsultation(req:Request, res:Response){
    try {
      const {id} = req.params
      const doctorUserId = (req as any).user.sub;

      const {diagnosis, doctorNotes, followUpRequired, folllowUpDate} = req.body

      if(!id){
        throw new Error("consultation id is required");
      }

      const result = await ConsultationService.completeConsultation(id,doctorUserId,{
        diagnosis, doctorNotes, followUpRequired, folllowUpDate
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async updateConsultationNotes(req:Request, res:Response){
    try {
      const {id} = req.params
      const doctorUserId = (req as any).user.sub;
      const {doctorNotes} = req.body;

      if(!id){
        throw new Error("Consultation id is required");
      }

      const result = await ConsultationService.updateConsultationNotes(id, doctorUserId,{doctorNotes});
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }


}
