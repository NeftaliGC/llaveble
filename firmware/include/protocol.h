#pragma once
// Constantes del protocolo BLE compartidas con la app web (web/src/app/core/ble.service.ts)

// UUIDs del servicio GATT ("4c4c" = "LL" de LlaveBLE)
#define SERVICE_UUID    "4c4c0000-a5e2-4b1a-9c3e-6c6c61766542"
#define CHR_INFO_UUID   "4c4c0001-a5e2-4b1a-9c3e-6c6c61766542"  // READ   : {"gid":..,"fw":..}
#define CHR_CHAL_UUID   "4c4c0002-a5e2-4b1a-9c3e-6c6c61766542"  // READ   : reto aleatorio de 16 bytes (nuevo en cada lectura)
#define CHR_AUTH_UUID   "4c4c0003-a5e2-4b1a-9c3e-6c6c61766542"  // WRITE  : fragmentos de "<jwt>.<prueba>"
#define CHR_RESULT_UUID "4c4c0004-a5e2-4b1a-9c3e-6c6c61766542"  // NOTIFY : código de resultado (texto corto)

// Fragmentación de AUTH: primer byte = banderas
#define CHUNK_FIRST 0x01
#define CHUNK_LAST  0x02

#define CHALLENGE_LEN       16
#define CHALLENGE_TTL_MS    30000
#define MAX_AUTH_LEN        1024

// Prefijo de dominio que firma el invitado:  "LLAVEBLE1" || gid || 0x00 || reto
#define PROOF_DOMAIN "LLAVEBLE1"

#define FW_VERSION "1.0.0"
