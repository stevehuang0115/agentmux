import { Router, Request, Response, NextFunction } from 'express';
import { UserIdentityService } from '../../services/user/user-identity.service.js';

/**
 * Create the user API router.
 *
 * Provides endpoints to list users, get a user by ID, and create/update users.
 *
 * @returns Express Router with user routes
 */
export function createUserRouter(): Router {
  const router = Router();
  const users = UserIdentityService.getInstance();

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await users.listUsers();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await users.getUserById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = String(req.body?.email || '').trim();
      const slackUserId = req.body?.slackUserId ? String(req.body.slackUserId) : undefined;
      if (!email) {
        res.status(400).json({ success: false, error: 'email is required' });
        return;
      }
      const user = await users.createOrUpdateUser({ email, slackUserId });
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
