import prisma from "../../prisma/client";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { AppError } from "../../utils/AppError";

type InitiateInput = {
  consultationId?: string;
  amount: number;
  currency?: string; // default INR
  paymentMethod: PaymentMethod;
  metadata?: any;
};

type ListOptions = {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
};

async function generatePaymentNumber(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const countToday = await prisma.payment.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      },
    },
  });
  const seq = String(countToday + 1).padStart(3, "0");
  return `PAY${y}${m}${d}${seq}`;
}

function mockGatewayCreate(amount: number, currency: string) {
  return {
    gatewayName: "MOCKPAY",
    gatewayTransactionId: `MOCK_${Date.now()}`,
    gatewayResponse: { ok: true, amount, currency },
    status: PaymentStatus.PENDING as PaymentStatus,
  };
}

function mockGatewayVerify(gatewayTransactionId: string) {
  return {
    verified: true,
    gatewayResponse: { verified: true, gatewayTransactionId },
    status: PaymentStatus.COMPLETED as PaymentStatus,
  };
}

function mockGatewayRefund(gatewayTransactionId: string, amount: number) {
  return {
    refunded: true,
    amount,
    gatewayResponse: { refunded: true, gatewayTransactionId, amount },
    status: PaymentStatus.REFUNDED as PaymentStatus,
  };
}

export default class PaymentService {
  static async initiate(userId: string, input: InitiateInput) {
    try {
      const { consultationId, amount, currency = "INR", paymentMethod, metadata } = input;
      if (!amount || amount <= 0) throw new AppError("Invalid amount", 400);

      if (consultationId) {
        const c = await prisma.consultation.findUnique({ where: { id: consultationId } });
        if (!c) throw new AppError("Consultation not found", 404);
        if (c.patientId !== userId) throw new AppError("Forbidden", 403);
      }

      const transactionNumber = await generatePaymentNumber();
      const gatewayInit = mockGatewayCreate(amount, currency);
      const combinedGatewayResponse = metadata
        ? { ...(gatewayInit.gatewayResponse as any), metadata }
        : gatewayInit.gatewayResponse;

      const payment = await prisma.payment.create({
        data: {
          transactionNumber,
          patientId: userId,
          consultationId: consultationId ?? null,
          amount,
          currency,
          paymentMethod,
          status: gatewayInit.status,
          gatewayName: gatewayInit.gatewayName,
          gatewayTransactionId: gatewayInit.gatewayTransactionId,
          gatewayResponse: combinedGatewayResponse,
          invoiceUrl: null,
        },
      });

      return payment;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to initiate payment", 500);
    }
  }

  static async getMyPayments(userId: string, opts: ListOptions) {
    try {
      const page = Math.max(1, opts.page ?? 1);
      const take = Math.max(1, Math.min(50, opts.limit ?? 10));
      const skip = (page - 1) * take;

      const where: any = { patientId: userId };
      if (opts.status) where.status = opts.status;

      const [total, items] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            consultation: {
              select: {
                id: true,
                consultationNumber: true,
                doctorId: true,
                scheduledStartTime: true,
              },
            },
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get payments", 500);
    }
  }

  static async getById(id: string, userId: string) {
    try {
      const p = await prisma.payment.findUnique({
        where: { id },
        include: { consultation: true },
      });
      if (!p) throw new AppError("Payment not found", 404);
      if (p.patientId !== userId) throw new AppError("Forbidden", 403);
      return p;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get payment", 500);
    }
  }

  static async getByConsultation(consultationId: string, userId: string) {
    try {
      const c = await prisma.consultation.findUnique({ where: { id: consultationId } });
      if (!c) throw new AppError("Consultation not found", 404);
      if (c.patientId !== userId) throw new AppError("Forbidden", 403);

      const payments = await prisma.payment.findMany({
        where: { consultationId },
        orderBy: { createdAt: "desc" },
      });
      return payments;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get payments for consultation", 500);
    }
  }

  static async process(id: string, userId: string) {
    try {
      const p = await prisma.payment.findUnique({ where: { id } });
      if (!p) throw new AppError("Payment not found", 404);
      if (p.patientId !== userId) throw new AppError("Forbidden", 403);

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          gatewayResponse: { ...(p.gatewayResponse as any), processedAt: new Date().toISOString() },
        },
      });
      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to process payment", 500);
    }
  }

  static async verify(id: string, userId: string) {
    try {
      const p = await prisma.payment.findUnique({ where: { id } });
      if (!p) throw new AppError("Payment not found", 404);
      if (p.patientId !== userId) throw new AppError("Forbidden", 403);

      const verifyRes = mockGatewayVerify(p.gatewayTransactionId || "");
      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: verifyRes.status,
          gatewayResponse: { ...(p.gatewayResponse as any), ...verifyRes.gatewayResponse },
          paidAt: verifyRes.status === PaymentStatus.COMPLETED ? new Date() : null,
        },
      });
      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to verify payment", 500);
    }
  }

  static async refund(id: string, userId: string, amount?: number) {
    try {
      const p = await prisma.payment.findUnique({ where: { id } });
      if (!p) throw new AppError("Payment not found", 404);
      if (p.patientId !== userId) throw new AppError("Forbidden", 403);

      const refundAmount = amount ?? Number(p.amount);
      const refundRes = mockGatewayRefund(p.gatewayTransactionId || "", refundAmount);

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: refundRes.status,
          refundAmount,
          refundReason: "Mock refund",
          refundedAt: new Date(),
          gatewayResponse: { ...(p.gatewayResponse as any), ...refundRes.gatewayResponse },
        },
      });
      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to refund payment", 500);
    }
  }

  static async invoice(id: string, userId: string) {
    try {
      const p = await prisma.payment.findUnique({
        where: { id },
        include: {
          consultation: {
            include: {
              doctor: { include: { user: true } },
              patient: true,
            },
          },
        },
      });
      if (!p) throw new AppError("Payment not found", 404);
      if (p.patientId !== userId) throw new AppError("Forbidden", 403);

      const lines: string[] = [];
      lines.push("Invoice");
      lines.push(`Transaction: ${p.transactionNumber}`);
      lines.push(`Status: ${p.status}`);
      lines.push(`Amount: ${p.amount} ${p.currency}`);
      if (p.consultation) {
        const docUser = (p.consultation.doctor as any)?.user;
        lines.push(`Consultation: ${p.consultation.consultationNumber}`);
        if (docUser) lines.push(`Doctor: ${docUser.firstName} ${docUser.lastName}`);
        lines.push(`Patient: ${p.consultation.patient.firstName} ${p.consultation.patient.lastName}`);
      }
      const content = lines.join("\n");
      const base64 = Buffer.from(content, "utf-8").toString("base64");
      return { fileName: `${p.transactionNumber}.txt`, contentType: "text/plain", base64 };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to generate invoice", 500);
    }
  }
}

