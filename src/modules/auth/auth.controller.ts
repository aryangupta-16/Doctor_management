import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export async function register(req: Request, res: Response) {
  const { email, password, firstName, lastName, phoneNumber } = req.body;
  const result = await AuthService.register({ email, password, firstName, lastName, phoneNumber });
  return res.status(201).json({ success: true, data: result });
}

export async function registerDoctor(req: Request, res: Response){
    const { email, password, firstName, lastName, phoneNumber, licenseNumber,specialtyPrimary, yearsOfExperience, consultationFee } = req.body;
    const result = await AuthService.registerDoctor({ email, password, firstName, lastName, phoneNumber, licenseNumber,specialtyPrimary, yearsOfExperience, consultationFee });
    return res.status(201).json({ success: true, data: result });
}

export async function login(req: Request, res: Response) {
  const { email, password, deviceInfo } = req.body;
  const result = await AuthService.login({ email, password, deviceInfo });
  return res.json({ success: true, data: result });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  const tokens = await AuthService.refresh({ refreshToken });
  return res.json({ success: true, data: tokens });
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  await AuthService.logout({ refreshToken });
  return res.json({ success: true });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  await AuthService.forgotPassword({ email });
  return res.json({ success: true });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body;
  await AuthService.resetPassword({ token, newPassword });
  return res.json({ success: true });
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.query as any;
  await AuthService.verifyEmail({ token });
  return res.json({ success: true });
}

export async function resendVerification(req: Request, res: Response) {
  const { email } = req.body;
  await AuthService.resendVerification({ email });
  return res.json({ success: true });
}
