#pragma once
#include <Arduino.h>

namespace ble {
void begin();

// Si llegó una solicitud completa de apertura, la copia en `out` y devuelve su longitud (0 si no hay).
size_t takeRequest(char* out, size_t max);

// Entrega el reto vigente (y lo invalida: un solo uso). Devuelve false si no hay o expiró.
bool takeChallenge(uint8_t out[16]);

void sendResult(const char* code);
bool isConnected();
}
