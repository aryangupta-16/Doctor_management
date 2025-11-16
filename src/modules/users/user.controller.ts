// src/modules/users/user.controller.ts
import { Request, Response } from 'express';
import { UserService } from './user.service';

export async function getMe(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    const user = await UserService.getMe(userId);
    return res.json({ success: true, data: user });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateMe(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    const payload = req.body;
    const user = await UserService.updateProfile(userId, payload);
    return res.json({ success: true, data: user });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function uploadProfilePicture(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    const file = req.file;
    // const result = await UserService.uploadProfilePicture(userId, file);
    return res.json({ success: true});
  } catch (err: any) {
    const status = err.message === 'NO_FILE' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    const { oldPassword, newPassword } = req.body;
    await UserService.changePassword(userId, oldPassword, newPassword);
    return res.json({ success: true, message: 'Password changed; you have been logged out from other sessions.' });
  } catch (err: any) {
    if (err.message === 'INVALID_OLD_PASSWORD') return res.status(401).json({ success: false, message: 'Old password is incorrect' });
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function deleteMe(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    await UserService.deleteUser(userId, userId);
    return res.json({ success: true, message: 'Account deleted permanently' });
  } catch (err: any) {
    const code = err.message === 'FORBIDDEN' ? 403 : 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

// Admin delete by id
export async function adminDeleteUserById(req: Request, res: Response) {
  try {
    const requesterId = (req as any).user?.sub;
    const targetUserId = req.params.id;
    await UserService.deleteUser(requesterId, targetUserId);
    return res.json({ success: true, message: 'User deleted permanently' });
  } catch (err: any) {
    const code = err.message === 'FORBIDDEN' ? 403 : 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}
