import bcrypt from 'bcrypt';
import { config } from '../config';

export async function hashPassword(password: string) {
  const rounds = config.bcryptRounds;
  return bcrypt.hash(password, rounds);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
