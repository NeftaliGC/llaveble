// Sesión simple del dueño: contraseña única y token aleatorio en memoria.
import crypto from 'node:crypto';
import { config } from './config.js';

const sessions = new Map(); // token -> expiración (ms)
const TTL_MS = 12 * 60 * 60 * 1000;

export function login(password) {
  const a = Buffer.from(String(password ?? ''));
  const b = Buffer.from(config.ownerPassword);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, Date.now() + TTL_MS);
  return token;
}

export function logout(token) {
  sessions.delete(token);
}

export function requireOwner(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Sesión inválida o vencida.' });
  }
  req.ownerToken = token;
  next();
}

export function requireDevice(req, res, next) {
  const key = Buffer.from(req.get('x-device-key') || '');
  const expected = Buffer.from(config.deviceKey);
  if (req.params.gid !== config.gateId || key.length !== expected.length || !crypto.timingSafeEqual(key, expected)) {
    return res.status(401).json({ error: 'Dispositivo no autorizado.' });
  }
  next();
}
