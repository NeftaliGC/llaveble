#include "access.h"
#include <ArduinoJson.h>
#include <time.h>
#include "b64url.h"
#include "config.h"
#include "es256.h"
#include "jwt.h"
#include "protocol.h"
#include "store.h"

namespace verifier
{

  static uint8_t serverPub[65];

  bool begin() { return hexToBytes(SERVER_PUBKEY_HEX, serverPub, sizeof(serverPub)) && serverPub[0] == 0x04; }

  const uint8_t *serverPublicKey() { return serverPub; }

  bool timeIsValid() { return time(nullptr) > 1700000000; } // NTP ya sincronizó

  static bool inSchedule(uint32_t daysMask, int tf, int tt)
  {
    time_t now = time(nullptr);
    struct tm lt;
    localtime_r(&now, &lt);
    int minute = lt.tm_hour * 60 + lt.tm_min;
    bool dayOk = daysMask & (1u << lt.tm_wday);
    bool timeOk = tf < tt ? (minute >= tf && minute < tt)  // p. ej. 09:00–18:00
                          : (minute >= tf || minute < tt); // cruza medianoche, p. ej. 22:00–06:00
    return dayOk && timeOk;
  }

  const char *check(const char *data, size_t len, const uint8_t *challenge, uint32_t &sn, char sub[33])
  {
    sn = 0;
    sub[0] = '\0';

    // 1) Separar "<jwt>.<prueba>": la prueba va después del último punto
    const char *lastDot = nullptr;
    for (size_t i = 0; i < len; i++)
      if (data[i] == '.')
        lastDot = data + i;
    if (!lastDot)
      return RES_BAD_FORMAT;
    size_t jwtLen = lastDot - data;
    uint8_t proof[64];
    if (b64urlDecode(lastDot + 1, len - jwtLen - 1, proof, sizeof(proof)) != 64)
      return RES_BAD_FORMAT;

    // 2) Firma del servidor sobre la credencial
    JsonDocument claims;
    bool badFormat;
    if (!jwtVerify(data, jwtLen, serverPub, claims, badFormat))
      return badFormat ? RES_BAD_FORMAT : RES_BAD_SIGNATURE;

    // 3) Tipo de token y portón
    if (strcmp(claims["t"] | "", "key") != 0 || (claims["v"] | 0) != 1)
      return RES_BAD_FORMAT;
    sn = claims["sn"] | 0u;
    strlcpy(sub, claims["sub"] | "", 33);
    if (strcmp(claims["gid"] | "", GATE_ID) != 0)
      return RES_WRONG_GATE;

    // 4) Reto vigente y de un solo uso
    if (!challenge)
      return RES_BAD_CHALLENGE;

    // 5) Prueba de posesión: el invitado firmó  "LLAVEBLE1" || gid || 0x00 || reto
    uint8_t guestPub[65];
    const char *pk = claims["pk"] | "";
    if (b64urlDecode(pk, strlen(pk), guestPub, sizeof(guestPub)) != 65)
      return RES_BAD_FORMAT;
    uint8_t msg[sizeof(PROOF_DOMAIN) - 1 + 32 + 1 + CHALLENGE_LEN];
    size_t m = 0;
    memcpy(msg + m, PROOF_DOMAIN, sizeof(PROOF_DOMAIN) - 1);
    m += sizeof(PROOF_DOMAIN) - 1;
    size_t gidLen = strlen(GATE_ID);
    if (gidLen > 32)
      gidLen = 32;
    memcpy(msg + m, GATE_ID, gidLen);
    m += gidLen;
    msg[m++] = 0x00;
    memcpy(msg + m, challenge, CHALLENGE_LEN);
    m += CHALLENGE_LEN;
    if (!es256Verify(guestPub, msg, m, proof))
      return RES_BAD_PROOF;

    // 6) Vigencia y horario (requiere hora sincronizada)
    if (!timeIsValid())
      return RES_NO_TIME;
    uint32_t now = (uint32_t)time(nullptr);
    if (now < (claims["nbf"] | 0u))
      return RES_NOT_YET_VALID;
    if (now > (claims["exp"] | 0u))
      return RES_EXPIRED;
    if (!inSchedule(claims["d"] | 0u, claims["tf"] | 0, claims["tt"] | 0))
      return RES_OUT_OF_SCHEDULE;

    // 7) Revocación
    if (store::isRevoked(sn))
      return RES_REVOKED;

    return RES_OK;
  }

} // namespace verifier