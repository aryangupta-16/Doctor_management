import { Router } from "express";
import PaymentController from "./payment.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";

const router = Router();

// All payment endpoints require authentication (patient)
router.post("/initiate", authenticateJWT, PaymentController.initiate);
router.get("/my", authenticateJWT, PaymentController.getMyPayments);
router.get("/:id", authenticateJWT, PaymentController.getById);
router.get("/consultation/:consultationId", authenticateJWT, PaymentController.getByConsultation);
router.post("/:id/verify", authenticateJWT, PaymentController.verify);
router.get("/:id/invoice", authenticateJWT, PaymentController.invoice);
router.post("/:id/process", authenticateJWT, PaymentController.process);
router.post("/:id/refund", authenticateJWT, PaymentController.refund);

export default router;

