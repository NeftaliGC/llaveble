// Llave de firma del servidor (ECDSA P-256 / ES256).
// La privada solo vive aquí; la pública se graba en el ESP32.
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPair, exportJWK, importJWK, SignJWT } from 'jose';
import { config } from './config.js';

const keyFile = path.join(config.dataDir, 'server-key.json');
let privateKey;
let publicJwk;

export async function loadKeys() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(keyFile)) {
    const pair = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(pair.privateKey);
    fs.writeFileSync(keyFile, JSON.stringify(jwk, null, 2), { mode: 0o600 });
    console.log(`[llaves] Nueva llave del servidor creada en ${keyFile}`);
  }
  const jwk = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  privateKey = await importJWK(jwk, 'ES256');
  publicJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

/** Firma un JWT ES256 con la llave del servidor. */
export function sign(claims) {
  return new SignJWT(claims).setProtectedHeader({ alg: 'ES256', typ: 'JWT' }).sign(privateKey);
}

/** Llave pública como punto sin comprimir: 0x04 || X || Y (65 bytes). */
export function publicKeyRaw() {
  return Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(publicJwk.x, 'base64url'),
    Buffer.from(publicJwk.y, 'base64url'),
  ]);
}

export function publicKeyJwk() {
  return publicJwk;
}

/** Texto listo para pegar en firmware/include/config.h */
export function publicKeyForFirmware() {
  const hex = publicKeyRaw().toString('hex');
  return `#define SERVER_PUBKEY_HEX "${hex}"`;
}
