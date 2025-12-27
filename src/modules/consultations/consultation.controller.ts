import { Request, Response } from 'express';
import ConsultationService from './consultation.service';
import { ConsultationStatus } from '@prisma/client';

export default class ConsultationController {

  static async bookConsultation(req:Request, res:Response){
    const patientId = (req as any).user.sub;

    const {slotId, consultationType, chiefComplaint, symptoms} = req.body;

    if(!slotId){
      throw new Error('slot id is required');
    }
    const result = await ConsultationService.bookConsultation(patientId,{
      slotId, consultationType, chiefComplaint, symptoms
    });
    return res.json({ success: true, data: result });
  }
  
  static async getMyConsultations(req: Request, res: Response) {
    const userId = (req as any).user.sub;
    const role = (req as any).user.roles;
  
    const {status,page,limit} = req.query;

    const result = await ConsultationService.getMyConsultations(userId, role, {
      status: status as ConsultationStatus,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    return res.json({ success: true, data: result });
  }

  static async getConsultationById(req:Request, res:Response){
    const {id} = req.params;
    const userId = (req as any).user.sub;
    const role = (req as any).user.roles;

    if(!id){
      throw new Error("consultation id is required");
    }

    const result = await ConsultationService.getConsultationById(id, userId, role);
    return res.json({ success: true, data: result });
  }

  static async cancelConsultation(req:Request, res:Response){
    const {id} = req.params;
    const userId = (req as any).user.sub;
    const role = (req as any).user.roles;

    const {reason} = req.body;

    if(!id){
      throw new Error("Consultation id is required");
    }

    if(!reason){
      throw new Error("Cancellation reason is required");
    }

    const cancelledBy = role;

    const result = await ConsultationService.cancelConsultation(id,userId,role,{
      reason, cancelledBy
    });
    return res.json({ success: true, data: result });
  }

  static async rescheduleConsultation(req:Request, res:Response){
    const {id} = req.params;
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
  }

  static async startConsultation(req:Request, res:Response){
    const {id} = req.params;
    const doctorUserId = (req as any).user.sub;

    if(!id){
      throw new Error("consultation id is required");
    }

    const result = await ConsultationService.startConsultation(id,doctorUserId);
    return res.json({ success: true, data: result });
  }

  static async completeConsultation(req:Request, res:Response){
    const {id} = req.params;
    const doctorUserId = (req as any).user.sub;

    const {diagnosis, doctorNotes, followUpRequired, folllowUpDate} = req.body;

    if(!id){
      throw new Error("consultation id is required");
    }

    const result = await ConsultationService.completeConsultation(id,doctorUserId,{
      diagnosis, doctorNotes, followUpRequired, folllowUpDate
    });
    return res.json({ success: true, data: result });
  }

  static async updateConsultationNotes(req:Request, res:Response){
    const {id} = req.params;
    const doctorUserId = (req as any).user.sub;
    const {doctorNotes} = req.body;

    if(!id){
      throw new Error("Consultation id is required");
    }

    const result = await ConsultationService.updateConsultationNotes(id, doctorUserId,{doctorNotes});
    return res.json({ success: true, data: result });
  }

  // ====== NEW METHODS FOR ADMIN, PATIENTS, AND DOCTORS ======

  // ADMIN: Get all consultations with filters
  static async getAllConsultations(req: Request, res: Response) {
    const { status, page, limit, patientId, doctorId, startDate, endDate } = req.query;

    const result = await ConsultationService.getAllConsultations({
      status: status as ConsultationStatus,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      patientId: patientId as string,
      doctorId: doctorId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    return res.json({ success: true, data: result });
  }

  // PATIENT: Get patient's consultations
  static async getPatientConsultations(req: Request, res: Response) {
    const patientId = (req as any).user.sub;
    const { status, page, limit, doctorId, startDate, endDate } = req.query;

    const result = await ConsultationService.getPatientConsultations(patientId, {
      status: status as ConsultationStatus,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      doctorId: doctorId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    return res.json({ success: true, data: result });
  }

  // DOCTOR: Get doctor's consultations
  static async getDoctorConsultations(req: Request, res: Response) {
    const doctorUserId = (req as any).user.sub;
    const { status, page, limit, startDate, endDate } = req.query;

    const result = await ConsultationService.getDoctorConsultations(doctorUserId, {
      status: status as ConsultationStatus,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    return res.json({ success: true, data: result });
  }

  // Get pending consultations (not started)
  static async getPendingConsultations(req: Request, res: Response) {
    const doctorUserId = (req as any).user.sub;
    const { page, limit } = req.query;

    const result = await ConsultationService.getPendingConsultations(doctorUserId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    return res.json({ success: true, data: result });
  }

  // Get upcoming consultations (for both patient and doctor)
  static async getUpcomingConsultations(req: Request, res: Response) {
    const userId = (req as any).user.sub;
    const role = (req as any).user.roles;
    const { page, limit } = req.query;

    const result = await ConsultationService.getUpcomingConsultations(userId, role, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    return res.json({ success: true, data: result });
  }

  // Get completed consultations
  static async getCompletedConsultations(req: Request, res: Response) {
    const userId = (req as any).user.sub;
    const role = (req as any).user.roles;
    const { page, limit, startDate, endDate } = req.query;

    const result = await ConsultationService.getCompletedConsultations(userId, role, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    return res.json({ success: true, data: result });
  }

}
