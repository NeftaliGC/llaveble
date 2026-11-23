// Rutas públicas para que el invitado active su llave.
import { Router } from 'express';
import { db } from '../db.js';
import { issueCredential, rowToDto, validateGuestPublicKey } from '../credentials.js';

export const invites = Router();

function findByCode(code) {
  return db.prepare('SELECT * FROM credentials WHERE invite_code = ?').get(String(code));
}

invites.get('/invites/:code', (req, res) => {
  const row = findByCode(req.params.code);
  if (!row) return res.status(404).json({ error: 'Invitación no encontrada.' });
  const dto = rowToDto(row);
  delete dto.inviteCode;
  res.json(dto);
});

invites.post('/invites/:code/claim', async (req, res) => {
  const row = findByCode(req.params.code);
  if (!row) return res.status(404).json({ error: 'Invitación no encontrada.' });
  if (row.status !== 'pending') return res.status(409).json({ error: 'Esta invitación ya fue usada o revocada.' });
  const pk = validateGuestPublicKey(req.body?.publicKey);
  if (!pk) return res.status(400).json({ error: 'Llave pública inválida.' });

  // Un solo uso: solo se activa si sigue pendiente (evita condiciones de carrera).
  const upd = db
    .prepare("UPDATE credentials SET public_key = ?, status = 'active', claimed_at = ? WHERE serial = ? AND status = 'pending'")
    .run(pk, Math.floor(Date.now() / 1000), row.serial);
  if (upd.changes !== 1) return res.status(409).json({ error: 'Esta invitación ya fue usada.' });

  const fresh = db.prepare('SELECT * FROM credentials WHERE serial = ?').get(row.serial);
  const token = await issueCredential(fresh, pk);
  const dto = rowToDto(fresh);
  delete dto.inviteCode;
  res.json({ token, credential: dto });
});
