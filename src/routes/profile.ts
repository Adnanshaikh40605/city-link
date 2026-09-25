import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { publicUser } from '../lib/auth.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ user: publicUser(user) });
});

router.patch('/', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(30).optional(),
    profileImage: z.string().url().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid profile update.' });
  }
  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      profileImage:
        parsed.data.profileImage === undefined
          ? undefined
          : parsed.data.profileImage,
    },
  });
  return res.json({ user: publicUser(user) });
});

export default router;
