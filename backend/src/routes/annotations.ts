import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { logDataAccess } from '../services/auditService';

const router = Router();

router.get('/', authenticateToken, requirePermission('map_annotations', 'read'), async (req: Request, res: Response) => {
  await logDataAccess('map_annotations', 'list', 'read', req.user!.id, req.ip, req.get('User-Agent') || '', 'success');
  res.json({ data: [] });
});

export default router;
