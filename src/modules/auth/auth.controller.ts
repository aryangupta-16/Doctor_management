import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export async function register(req: Request, res: Response) {
  try {
    const { email, password, firstName, lastName, phoneNumber } = req.body;
    const result = await AuthService.register({ email, password, firstName, lastName, phoneNumber });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'EMAIL_EXISTS') return res.status(400).json({ message: 'Email already exists' });
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function registerDoctor(req: Request, res: Response){
    try{
        const { email, password, firstName, lastName, phoneNumber, licenseNumber,specialtyPrimary, yearsOfExperience, consultationFee } = req.body;
        const result = await AuthService.registerDoctor({ email, password, firstName, lastName, phoneNumber, licenseNumber,specialtyPrimary, yearsOfExperience, consultationFee });
        return res.status(201).json({ success: true, data: result });
    }catch(err: any){
        if (err.message === 'EMAIL_EXISTS') return res.status(400).json({ message: 'Email already exists' });
        return res.status(500).json({ message: err.message || 'Server error' });
    }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password, deviceInfo } = req.body;
    console.log("email:", email);
    console.log("password:", password);
    console.log("deviceInfo:", deviceInfo);
    const result = await AuthService.login({ email, password, deviceInfo });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') return res.status(401).json({ message: 'Invalid credentials' });
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    const tokens = await AuthService.refresh({ refreshToken });
    return res.json({ success: true, data: tokens });
  } catch (err: any) {
    return res.status(401).json({ message: err.message || 'Invalid refresh token' });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    await AuthService.logout({ refreshToken });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    await AuthService.forgotPassword({ email });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;
    await AuthService.resetPassword({ token, newPassword });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Invalid token or request' });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.query as any;
    await AuthService.verifyEmail({ token });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Invalid token' });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;
    await AuthService.resendVerification({ email });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}
