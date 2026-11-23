#pragma once
#include <Arduino.h>

// Tarea en segundo plano: Wi-Fi, hora por NTP y sincronización con el servidor
// (envía la bitácora y recibe la lista de revocación firmada).
namespace netsync {
void begin();
bool wifiConnected();
}
