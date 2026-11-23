import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT || 3000),
  ownerPassword: process.env.OWNER_PASSWORD || 'cambia-esta-contrasena',
  gateId: process.env.GATE_ID || 'porton-01',
  deviceKey: process.env.DEVICE_KEY || 'cambia-esta-clave-del-dispositivo',
  tzOffset: process.env.TZ_OFFSET || '-06:00',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  webDist: process.env.WEB_DIST || path.join(root, '..', 'web', 'dist', 'web', 'browser'),
};
