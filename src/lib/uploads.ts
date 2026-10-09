import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import type { Request } from 'express';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.gif',
      '.mp4',
      '.webm',
      '.mov',
    ].includes(ext)
      ? ext
      : '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
  },
});

const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export const videoUpload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!videoTypes.has(file.mimetype)) {
      cb(new Error('Only MP4, WebM, or MOV video files are allowed.'));
      return;
    }
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, true);
    void ext;
  },
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'));
      return;
    }
    cb(null, true);
  },
});

export function publicBaseUrl(req: Request) {
  const fromEnv = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

export function filePublicUrl(req: Request, filename: string) {
  return `${publicBaseUrl(req)}/uploads/${filename}`;
}
