import { Request, Response } from "express";
import PaymentService from "./payment.service";

export default class PaymentController {
  static async initiate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { consultationId, amount, currency, paymentMethod, metadata } = req.body;

      if (!amount) throw new Error("amount is required");
      if (!paymentMethod) throw new Error("paymentMethod is required");

      const result = await PaymentService.initiate(userId, {
        consultationId,
        amount: Number(amount),
        currency,
        paymentMethod,
        metadata,
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getMyPayments(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { page, limit, status } = req.query;
      const result = await PaymentService.getMyPayments(userId, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        status: status as any,
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const result = await PaymentService.getById(id, userId);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getByConsultation(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { consultationId } = req.params;
      const result = await PaymentService.getByConsultation(consultationId, userId);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async process(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const result = await PaymentService.process(id, userId);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async verify(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const result = await PaymentService.verify(id, userId);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async refund(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const { amount } = req.body;
      const result = await PaymentService.refund(id, userId, amount ? Number(amount) : undefined);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async invoice(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const file = await PaymentService.invoice(id, userId);
      return res.json({ success: true, data: file });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}

