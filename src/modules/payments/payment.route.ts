import { Router } from "express";
import PaymentController from "./payment.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

// All payment endpoints require authentication (patient)
router.post("/initiate", authenticateJWT, asyncHandler(PaymentController.initiate));
router.get("/my", authenticateJWT, asyncHandler(PaymentController.getMyPayments));
router.get("/:id", authenticateJWT, asyncHandler(PaymentController.getById));
router.get("/consultation/:consultationId", authenticateJWT, asyncHandler(PaymentController.getByConsultation));
router.post("/:id/verify", authenticateJWT, asyncHandler(PaymentController.verify));
router.get("/:id/invoice", authenticateJWT, asyncHandler(PaymentController.invoice));
router.post("/:id/process", authenticateJWT, asyncHandler(PaymentController.process));
router.post("/:id/refund", authenticateJWT, asyncHandler(PaymentController.refund));

export default router;

