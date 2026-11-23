#pragma once
#include <Arduino.h>

// Decodifica base64url (sin relleno). Devuelve la cantidad de bytes o -1 si es inválido.
int b64urlDecode(const char* in, size_t inLen, uint8_t* out, size_t outMax);

// Convierte texto hexadecimal a bytes. Devuelve true si la longitud coincide.
bool hexToBytes(const char* hex, uint8_t* out, size_t outLen);
