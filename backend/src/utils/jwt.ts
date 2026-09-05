import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { config } from '../config/env';
import { AppError } from './errors';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return decoded;
  } catch (error) {
    throw AppError.unauthorized('Invalid or expired authentication token');
  }
}
