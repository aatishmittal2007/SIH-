import { UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { hashPassword, verifyPassword } from '../../utils/password';
import { generateToken } from '../../utils/jwt';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../../utils/audit';
import { RegisterInput, LoginInput } from './auth.schema';

export class AuthService {
  static async register(input: RegisterInput, ipAddress?: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw AppError.conflict('An account with this email address already exists');
    }

    const passwordHash = await hashPassword(input.password);

    // Default public registration role is ANALYST for security
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        passwordHash,
        role: UserRole.ANALYST,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'REGISTER',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { role: user.role, email: user.email },
      ipAddress,
    });

    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    return { user, token };
  }

  static async login(input: LoginInput, ipAddress?: string) {
    const emailNormalized = input.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: emailNormalized },
    });

    if (!user) {
      await createAuditLog({
        userId: null,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        metadata: { email: emailNormalized, reason: 'User not found' },
        ipAddress,
      });
      throw AppError.unauthorized('Invalid email address or password');
    }

    if (!user.isActive) {
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { email: emailNormalized, reason: 'Account inactive' },
        ipAddress,
      });
      throw AppError.unauthorized('Account has been deactivated. Contact an administrator.');
    }

    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { email: emailNormalized, reason: 'Invalid password' },
        ipAddress,
      });
      throw AppError.unauthorized('Invalid email address or password');
    }

    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    await createAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { email: user.email, role: user.role },
      ipAddress,
    });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };

    return { user: safeUser, token };
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw AppError.notFound('User profile not found');
    }

    return user;
  }
}
