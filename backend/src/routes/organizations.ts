import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validate, createOrganizationSchema, updateOrganizationSchema } from '../middleware/validation';
import { NotFoundError } from '../types';
import { logDataAccess } from '../services/auditService';

const router = Router();

// Mock organization service for now
const mockOrganizations = [
  { id: '1', name: 'CDC', type: 'government', region: 'US', country: 'United States' },
  { id: '2', name: 'WHO', type: 'ngo', region: 'Global', country: 'Switzerland' }
];

router.get('/', authenticateToken, requirePermission('organizations', 'read'), async (req: Request, res: Response) => {
  await logDataAccess('organizations', 'list', 'read', req.user!.id, req.ip, req.get('User-Agent') || '', 'success');
  res.json({ data: mockOrganizations });
});

router.get('/:id', authenticateToken, requirePermission('organizations', 'read'), async (req: Request, res: Response) => {
  const org = mockOrganizations.find(o => o.id === req.params.id);
  if (!org) throw new NotFoundError('Organization', req.params.id);
  
  await logDataAccess('organizations', req.params.id, 'read', req.user!.id, req.ip, req.get('User-Agent') || '', 'success');
  res.json({ data: org });
});

export default router;
