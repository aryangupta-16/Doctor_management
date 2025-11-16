import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { json } from "body-parser";
import { logger } from "./config/logger";
// import { errorHandler } from "./common/middlewares/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.route"
import doctorRoutes from './modules/doctors/doctor.route';
import availabilityRoutes from './modules/availability/availability.route'
import searchRoutes from './modules/search/search.route'
import consultationRoutes from './modules/consultations/consultation.route'
import PrescriptionRoutes from './modules/prescriptions/prescription.route'
import PaymentRoutes from './modules/payments/payment.route'
import AdminRoutes from './modules/admin/admin.route'

import { metricsMiddleware } from './metrics/metrics.middleware';
import metricsRoute from './metrics/metrics.route';

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(json());

app.use(metricsMiddleware);

app.use(metricsRoute);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users",userRoutes)
app.use('/api/doctors', doctorRoutes);
app.use("/api/availability",availabilityRoutes)
app.use("/api/search",searchRoutes)
app.use("/api/consultation",consultationRoutes)
app.use("/api/prescriptions",PrescriptionRoutes)
app.use("/api/payments",PaymentRoutes)
app.use("/api/admin", AdminRoutes)

// Health Check
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// Error handler
// app.use(errorHandler);

export { app };
