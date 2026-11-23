// Lógica de llaves: creación de invitaciones, emisión, revocación y sincronización.
import crypto from 'node:crypto';
import { db } from './db.js';
import { config } from './config.js';
import { sign } from './keys.js';

const MAX_REVOKED_IN_LIST = 64;

export function parseHHMM(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s ?? ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toHHMM(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? '')) && !Number.isNaN(Date.parse(s));
}

/** Convierte una fecha local AAAA-MM-DD + hora a segundos unix usando el desfase configurado. */
export function localToUnix(date, time) {
  return Math.floor(Date.parse(`${date}T${time}${config.tzOffset}`) / 1000);
}

export function rowToDto(r) {
  const now = Math.floor(Date.now() / 1000);
  const exp = localToUnix(r.valid_to, '23:59:59');
  let status = r.status;
  if (status !== 'revoked' && now > exp) status = 'expired';
  return {
    serial: r.serial,
    guestName: r.guest_name,
    gateId: r.gate_id,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    days: daysFromMask(r.days),
    timeFrom: toHHMM(r.time_from),
    timeTo: toHHMM(r.time_to),
    status,
    inviteCode: r.status === 'pending' ? r.invite_code : null,
    createdAt: r.created_at,
    claimedAt: r.claimed_at,
    revokedAt: r.revoked_at,
  };
}

export function daysFromMask(mask) {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => mask & (1 << d));
}

/** Valida los datos de una nueva invitación. Devuelve { error } o los valores normalizados. */
export function validateInvite(body) {
  const guestName = String(body?.guestName ?? '').trim();
  if (!guestName || guestName.length > 32) return { error: 'El nombre debe tener entre 1 y 32 caracteres.' };
  if (!isDate(body.validFrom) || !isDate(body.validTo)) return { error: 'Fechas inválidas (formato AAAA-MM-DD).' };
  if (body.validTo < body.validFrom) return { error: 'La fecha final es anterior a la inicial.' };
  const days = Array.isArray(body.days) ? body.days.map(Number).filter((d) => d >= 0 && d <= 6) : [];
  if (days.length === 0) return { error: 'Selecciona al menos un día.' };
  const timeFrom = parseHHMM(body.timeFrom);
  const timeTo = parseHHMM(body.timeTo === '24:00' ? '23:59' : body.timeTo);
  if (timeFrom === null || timeTo === null) return { error: 'Horario inválido (formato HH:MM).' };
  if (timeFrom === timeTo) return { error: 'La hora de inicio y fin no pueden ser iguales.' };
  const mask = days.reduce((m, d) => m | (1 << d), 0);
  return { guestName, validFrom: body.validFrom, validTo: body.validTo, mask, timeFrom, timeTo };
}

export function createInvite(v) {
  const code = crypto.randomBytes(18).toString('base64url');
  const info = db
    .prepare(
      `INSERT INTO credentials (gate_id, guest_name, valid_from, valid_to, days, time_from, time_to, invite_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(config.gateId, v.guestName, v.validFrom, v.validTo, v.mask, v.timeFrom, v.timeTo, code, Math.floor(Date.now() / 1000));
  return { serial: Number(info.lastInsertRowid), inviteCode: code };
}

/** Comprueba que la llave pública del invitado sea un punto P-256 válido (65 bytes, sin comprimir). */
export function validateGuestPublicKey(b64) {
  try {
    const raw = Buffer.from(String(b64 ?? ''), 'base64url');
    if (raw.length !== 65 || raw[0] !== 0x04) return null;
    crypto.createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') },
      format: 'jwk',
    });
    return raw.toString('base64url');
  } catch {
    return null;
  }
}

/** Emite la credencial JWT ES256 que el ESP32 verificará sin conexión. */
export async function issueCredential(row, publicKeyB64) {
  return sign({
    t: 'key',                         // tipo de token
    v: 1,                             // versión del formato
    sn: row.serial,                   // número de serie (para revocar)
    gid: row.gate_id,                 // portón al que aplica
    sub: row.guest_name,              // invitado
    nbf: localToUnix(row.valid_from, '00:00:00'),
    exp: localToUnix(row.valid_to, '23:59:59'),
    d: row.days,                      // días permitidos (bit 0 = domingo)
    tf: row.time_from,                // minuto de inicio (hora local)
    tt: row.time_to,                  // minuto de fin (hora local)
    pk: publicKeyB64,                 // llave pública del invitado
    iat: Math.floor(Date.now() / 1000),
  });
}

export function revoke(serial) {
  const row = db.prepare('SELECT * FROM credentials WHERE serial = ?').get(serial);
  if (!row) return { error: 'No existe esa llave.', status: 404 };
  if (row.status === 'revoked') return { row };
  db.transaction(() => {
    db.prepare("UPDATE credentials SET status = 'revoked', revoked_at = ? WHERE serial = ?").run(Math.floor(Date.now() / 1000), serial);
    db.prepare('UPDATE revocation_state SET version = version + 1 WHERE gate_id = ?').run(row.gate_id);
  })();
  return { row: db.prepare('SELECT * FROM credentials WHERE serial = ?').get(serial) };
}

/** Lista de revocación firmada para el portón (solo llaves revocadas que aún no vencen). */
export async function signedRevocationList(gateId) {
  const now = Math.floor(Date.now() / 1000);
  const { version } = db.prepare('SELECT version FROM revocation_state WHERE gate_id = ?').get(gateId);
  const rows = db
    .prepare("SELECT serial, valid_to FROM credentials WHERE gate_id = ? AND status = 'revoked' ORDER BY revoked_at DESC")
    .all(gateId)
    .filter((r) => localToUnix(r.valid_to, '23:59:59') >= now)
    .slice(0, MAX_REVOKED_IN_LIST);
  return sign({ t: 'rev', gid: gateId, ver: version, rev: rows.map((r) => r.serial), iat: now });
}
