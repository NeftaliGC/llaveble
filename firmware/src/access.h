#pragma once
#include <Arduino.h>

// Códigos de resultado (los mismos que muestra la app web y registra el servidor)
#define RES_OK "OK"
#define RES_BAD_FORMAT "BAD_FORMAT"
#define RES_BAD_SIGNATURE "BAD_SIGNATURE"
#define RES_WRONG_GATE "WRONG_GATE"
#define RES_BAD_CHALLENGE "BAD_CHALLENGE"
#define RES_BAD_PROOF "BAD_PROOF"
#define RES_NO_TIME "NO_TIME"
#define RES_NOT_YET_VALID "NOT_YET_VALID"
#define RES_EXPIRED "EXPIRED"
#define RES_OUT_OF_SCHEDULE "OUT_OF_SCHEDULE"
#define RES_REVOKED "REVOKED"
#define RES_RATE_LIMIT "RATE_LIMIT"

namespace verifier
{
    bool begin(); // carga la llave pública del servidor; false si config.h no está lleno

    // Valida "<jwt>.<prueba>" contra el reto vigente. `challenge` es nullptr si no había reto válido.
    // Devuelve uno de los códigos RES_*; llena sn y sub cuando la credencial se pudo leer.
    const char *check(const char *data, size_t len, const uint8_t *challenge, uint32_t &sn, char sub[33]);

    const uint8_t *serverPublicKey();
    bool timeIsValid();
}