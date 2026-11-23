#pragma once
#include <Arduino.h>

// SHA-256 de un mensaje.
void sha256(const uint8_t* msg, size_t len, uint8_t out[32]);

// Verifica una firma ECDSA P-256 (formato r||s de 64 bytes, como JWT ES256 y Web Crypto)
// sobre SHA-256(msg), con una llave pública sin comprimir (0x04||X||Y, 65 bytes).
bool es256Verify(const uint8_t pub[65], const uint8_t* msg, size_t len, const uint8_t sig[64]);
