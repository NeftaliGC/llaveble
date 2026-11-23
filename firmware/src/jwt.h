#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

// Verifica un JWT ES256 firmado por el servidor y carga sus datos (claims) en `payload`.
// Devuelve true solo si el formato es correcto y la firma es válida.
// `badFormat` indica si el fallo fue de formato (true) o de firma (false).
bool jwtVerify(const char* jwt, size_t len, const uint8_t serverPub[65], JsonDocument& payload, bool& badFormat);
