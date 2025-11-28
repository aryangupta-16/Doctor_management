// src/modules/doctors/doctor.controller.ts
import { Request, Response } from 'express';
import { DoctorService } from './doctor.service';

export class DoctorController {
  static async getDoctorById(req: Request, res: Response) {
    const { doctorId } = req.params;
    const result = await DoctorService.getDoctorById(doctorId);
    console.log("result",result);
    return res.json({ success: true, doctor: result });
  }

  static async getOwnDoctorProfile(req: Request, res: Response) {
    const userId = req.user ? req.user?.sub : "";
    console.log("in controller");
    const result = await DoctorService.getOwnDoctorProfile(userId);
    return res.json({ success: true, doctor: result });
  }

  static async updateDoctorProfile(req: Request, res: Response) {
    const { doctorId } = req.params;
    const result = await DoctorService.updateDoctorProfile(doctorId, req.body);
    return res.json({ success: true, doctor: result });
  }
}
