import { Request, Response } from 'express';
import PrescriptionService from './prescription.service';

export default class PrescriptionController {

    static async createPrescription(req: Request, res: Response) {
        const doctorUserId = (req as any).user.sub;
        const { consultationId, medications, instructions, validUntil } = req.body;

        if (!consultationId) {
            throw new Error("Consultation Id is required");
        }

        const result = await PrescriptionService.createPrescription(doctorUserId, { consultationId, medications, instructions, validUntil });
        return res.json({ success: true, data: result });
    }

    static async getMyPrescription(req: Request, res: Response) {
        const userId = (req as any).user.sub;
        const role = (req as any).user.roles;

        const { page, limit, search } = req.query;

        const result = await PrescriptionService.getMyPrescriptions(userId, role, {
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            search: search as string
        });

        return res.json({ success: true, data: result });
    }

    static async getPrescriptionById(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req as any).user.sub;
        const role = (req as any).user.roles;

        if (!id) {
            throw new Error("Prescription id is required");
        }

        const result = await PrescriptionService.getPrescriptionById(id, userId, role);
        return res.json({ success: true, data: result });
    }

    static async getPrescriptionByConsultationId(req: Request, res: Response) {
        const { consultationId } = req.params;
        const userId = (req as any).user.sub;
        const role = (req as any).user.roles;

        if (!consultationId) {
            throw new Error("Consultation Id is required");
        }

        const result = await PrescriptionService.getPrescriptionByConsultation(consultationId, userId, role);
        return res.json({ success: true, data: result });
    }

    static async updatePrescription (req: Request, res: Response) {
        const { id } = req.params;
        const doctorUserId = (req as any).user.sub;

        const {medications,instructions, validUntil} = req.body;

        if (!id) {
            throw new Error("Prescription Id is required");
        }

        const result = await PrescriptionService.updatePrescription(id, doctorUserId, {medications,instructions, validUntil});
        return res.json({ success: true, data: result });
    }

    static async deletePrescription(req: Request, res: Response) {
        const { id } = req.params;
        const doctorUserId = (req as any).user.sub;


        if (!id) {
            throw new Error("Prescription Id is required");
        }

        const result = await PrescriptionService.deletePrescription(id, doctorUserId);
        return res.json({ success: true, data: result });
    }

    static async downloadPrescription(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req as any).user.sub;
        const role = (req as any).roles;

        if (!id) {
            throw new Error("Prescription Id is required");
        }

        const result = await PrescriptionService.downloadPrescription(id, userId, role);
        return res.json({ success: true, data: result });
    }
}
