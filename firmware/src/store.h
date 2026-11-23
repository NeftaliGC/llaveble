#pragma once
#include <Arduino.h>

// Estado compartido entre la tarea de BLE/acceso y la de sincronización (protegido con mutex).

#define MAX_REVOKED   64
#define MAX_EVENTS    32

struct AccessEvent {
  uint32_t ts;
  uint32_t sn;
  char sub[33];
  char code[20];
};

namespace store {
void begin();

// Lista de revocación (persistida en flash con Preferences)
bool isRevoked(uint32_t sn);
uint32_t revocationVersion();
// Reemplaza la lista solo si la versión es igual o más nueva (evita regresar a una lista vieja).
bool updateRevocations(uint32_t version, const uint32_t* serials, size_t count);

// Bitácora pendiente de enviar al servidor
void logEvent(uint32_t sn, const char* sub, const char* code);
size_t copyEvents(AccessEvent* out, size_t max);
void dropEvents(size_t count);
}
