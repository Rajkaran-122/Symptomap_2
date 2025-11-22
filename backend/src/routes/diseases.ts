import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { logDataAccess } from '../services/auditService';

const router = Router();

// Mock diseases data
const mockDiseases = [
  { id: '1', name: 'COVID-19', category: 'respiratory', icd10Code: 'U07.1', symptoms: ['fever', 'cough', 'shortness of breath'] },
  { id: '2', name: 'Influenza', category: 'respiratory', icd10Code: 'J10', symptoms: ['fever', 'cough', 'muscle aches'] }
];

router.get('/', authenticateToken, requirePermission('diseases', 'read'), async (req: Request, res: Response) => {
  await logDataAccess('diseases', 'list', 'read', req.user!.id, req.ip, req.get('User-Agent') || '', 'success');
  res.json({ data: mockDiseases });
});

export default router;
