import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_tracex_jwt_key_sih_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@tracex.gov.in',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'AdminPass123!',
};
