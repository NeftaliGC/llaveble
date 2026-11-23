// Rutas del panel del dueño (requieren sesión).
import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { login, logout, requireOwner } from '../auth.js';
import { createInvite, revoke, rowToDto, validateInvite } from '../credentials.js';
import { publicKeyForFirmware, publicKeyRaw } from '../keys.js';

export const owner = Router();

const ONLINE_WINDOW_S = 60;

function baseUrl(req) {
  return config.publicUrl || `${req.protocol}://${req.get('host')}`;
}

owner.post('/auth/login', (req, res) => {
  const token = login(req.body?.password);
  if (!token) return res.status(401).json({ error: 'Contraseña incorrecta.' });
  res.json({ token });
});

owner.post('/auth/logout', requireOwner, (req, res) => {
  logout(req.ownerToken);
  res.json({ ok: true });
});

owner.get('/status', requireOwner, (req, res) => {
  const gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(config.gateId);
  const { version } = db.prepare('SELECT version FROM revocation_state WHERE gate_id = ?').get(config.gateId);
  const now = Math.floor(Date.now() / 1000);
  res.json({
    gateId: gate.id,
    lastSeen: gate.last_seen,
    online: !!gate.last_seen && now - gate.last_seen <= ONLINE_WINDOW_S,
    revocationVersion: version,
    serverTime: now,
  });
});

owner.get('/credentials', requireOwner, (req, res) => {
  const rows = db.prepare('SELECT * FROM credentials ORDER BY serial DESC').all();
  const base = baseUrl(req);
  res.json(rows.map((r) => {
    const dto = rowToDto(r);
    return { ...dto, inviteUrl: dto.inviteCode ? `${base}/invitacion/${dto.inviteCode}` : null };
  }));
});

owner.post('/credentials', requireOwner, (req, res) => {
  const v = validateInvite(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const { serial, inviteCode } = createInvite(v);
  res.status(201).json({ serial, inviteCode, inviteUrl: `${baseUrl(req)}/invitacion/${inviteCode}` });
});

owner.post('/credentials/:serial/revoke', requireOwner, (req, res) => {
  const result = revoke(Number(req.params.serial));
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(rowToDto(result.row));
});

owner.get('/events', requireOwner, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(db.prepare('SELECT * FROM events ORDER BY ts DESC, id DESC LIMIT ?').all(limit));
});

owner.get('/server-key', requireOwner, (req, res) => {
  res.json({ hex: publicKeyRaw().toString('hex'), firmwareLine: publicKeyForFirmware() });
});
