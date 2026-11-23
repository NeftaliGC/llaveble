#include "jwt.h"
#include "b64url.h"
#include "es256.h"

bool jwtVerify(const char* jwt, size_t len, const uint8_t serverPub[65], JsonDocument& payload, bool& badFormat) {
  badFormat = true;
  const char* dot1 = (const char*)memchr(jwt, '.', len);
  if (!dot1) return false;
  const char* dot2 = (const char*)memchr(dot1 + 1, '.', len - (dot1 + 1 - jwt));
  if (!dot2) return false;
  if (memchr(dot2 + 1, '.', len - (dot2 + 1 - jwt))) return false;

  // Encabezado: debe ser ES256
  uint8_t buf[600];
  int n = b64urlDecode(jwt, dot1 - jwt, buf, sizeof(buf));
  if (n <= 0) return false;
  JsonDocument header;
  if (deserializeJson(header, buf, n)) return false;
  if (strcmp(header["alg"] | "", "ES256") != 0) return false;

  // Firma (r||s, 64 bytes)
  uint8_t sig[64];
  if (b64urlDecode(dot2 + 1, len - (dot2 + 1 - jwt), sig, sizeof(sig)) != 64) return false;

  // Datos
  n = b64urlDecode(dot1 + 1, dot2 - (dot1 + 1), buf, sizeof(buf));
  if (n <= 0) return false;
  if (deserializeJson(payload, buf, n)) return false;

  badFormat = false;
  // La firma cubre "encabezado.datos" en texto ASCII
  return es256Verify(serverPub, (const uint8_t*)jwt, dot2 - jwt, sig);
}
