import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// Test protected endpoint (accessible by any authenticated user)
router.get('/protected/test', authenticateToken, (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Authenticated request successful',
    user: {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
    },
  });
});

// Test admin endpoint (accessible ONLY by ADMIN role)
router.get('/admin/test', authenticateToken, authorizeRoles(UserRole.ADMIN), (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Admin authorization verified',
    user: {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
    },
  });
});

export default router;
