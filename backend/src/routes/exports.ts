import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { logDataAccess } from '../services/auditService';

const router = Router();

router.post('/', authenticateToken, requirePermission('exports', 'create'), async (req: Request, res: Response) => {
  await logDataAccess('exports', 'create', 'create', req.user!.id, req.ip, req.get('User-Agent') || '', 'success');
  res.json({ message: 'Export functionality coming soon' });
});

export default router;
