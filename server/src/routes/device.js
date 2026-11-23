// Rutas del portón (ESP32): sincroniza bitácora y recibe la lista de revocación firmada.
import { Router } from 'express';
import { db } from '../db.js';
import { requireDevice } from '../auth.js';
import { signedRevocationList } from '../credentials.js';

export const device = Router();

const KNOWN_CODES = new Set([
  'OK', 'BAD_FORMAT', 'BAD_SIGNATURE', 'WRONG_GATE', 'NOT_YET_VALID', 'EXPIRED',
  'OUT_OF_SCHEDULE', 'REVOKED', 'BAD_CHALLENGE', 'BAD_PROOF', 'NO_TIME', 'RATE_LIMIT', 'BOOT',
]);

device.post('/device/:gid/sync', requireDevice, async (req, res) => {
  const gid = req.params.gid;
  const now = Math.floor(Date.now() / 1000);
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 100) : [];

  const insert = db.prepare('INSERT INTO events (gate_id, ts, serial, guest, code, received_at) VALUES (?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    for (const e of events) {
      const code = KNOWN_CODES.has(e?.code) ? e.code : 'UNKNOWN';
      // Antes de sincronizar la hora (NTP) el ESP32 manda segundos desde el arranque: se usa la hora del servidor
      const ts = Number.isInteger(e?.ts) && e.ts > 1700000000 ? e.ts : now;
      const serial = Number.isInteger(e?.sn) && e.sn > 0 ? e.sn : null;
      const guest = typeof e?.sub === 'string' ? e.sub.slice(0, 32) : null;
      insert.run(gid, ts, serial, guest, code, now);
    }
    db.prepare('UPDATE gates SET last_seen = ? WHERE id = ?').run(now, gid);
  })();

  res.json({ rev: await signedRevocationList(gid), time: now });
});
