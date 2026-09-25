import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import {
  hashPassword,
  publicUser,
  signToken,
  verifyPassword,
} from '../lib/auth.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

const emailSchema = z.string().email();

router.post('/signup', async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid signup data.', details: parsed.error.flatten() });
  }
  const { name, email, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
    },
  });

  const token = signToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const schema = z.object({
    email: emailSchema,
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid email and password.' });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/logout', requireAuth, async (_req, res) => {
  // Stateless JWT  client discards token. Endpoint exists for product flow.
  return res.json({ ok: true });
});

router.post('/password-recovery', async (req, res) => {
  const schema = z.object({ email: emailSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  // Always return success to avoid email enumeration.
  const base = {
    message:
      'If an account exists for that email, password recovery instructions were sent.',
  };

  if (!user) {
    return res.json(base);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const payload: Record<string, unknown> = { ...base };
  if (process.env.EXPOSE_RESET_TOKEN === 'true') {
    payload.resetToken = rawToken;
    payload.devNote =
      'EXPOSE_RESET_TOKEN=true  use this token with POST /auth/password-reset. Configure email in production.';
  }
  return res.json(payload);
});

router.post('/password-reset', async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid reset request.' });
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(parsed.data.token)
    .digest('hex');
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!record) {
    return res.status(400).json({ error: 'Reset link is invalid or expired.' });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return res.json({ message: 'Password updated. You can log in now.' });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Account not found.' });
  }
  return res.json({ user: publicUser(user) });
});

router.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
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
      profileImage: parsed.data.profileImage === undefined
        ? undefined
        : parsed.data.profileImage,
    },
  });
  return res.json({ user: publicUser(user) });
});

router.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  await prisma.user.delete({ where: { id: req.userId! } });
  return res.json({ ok: true, message: 'Account deleted.' });
});

export default router;
