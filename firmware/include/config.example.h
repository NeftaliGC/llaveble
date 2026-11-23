#pragma once
// ============================================================================
//  LlaveBLE - configuración del portón
//  Copia este archivo como include/config.h y llena tus datos.
// ============================================================================

// ---------- Red Wi-Fi (la misma red que la laptop del servidor) -------------
#define WIFI_SSID      "TU_RED_WIFI"
#define WIFI_PASSWORD  "TU_CONTRASENA_WIFI"

// ---------- Servidor --------------------------------------------------------
// IP de la laptop en tu red local + puerto (ver "ip a" / "ipconfig").
// También acepta la URL https del túnel, p. ej. "https://algo.trycloudflare.com"
#define SERVER_URL     "http://192.168.1.50:3000"

// Deben coincidir con GATE_ID y DEVICE_KEY del archivo server/.env
#define GATE_ID        "porton-01"
#define DEVICE_KEY     "cambia-esta-clave-del-dispositivo"

// Llave pública del servidor (65 bytes en hex). El servidor la imprime al
// arrancar, o ejecuta:  cd server && npm run llave-publica
#define SERVER_PUBKEY_HEX "PEGA_AQUI_LA_LLAVE_PUBLICA_DEL_SERVIDOR"

// ---------- Hora -------------------------------------------------------------
// Zona horaria POSIX. Ciudad de México (sin horario de verano) = "CST6"
#define TZ_INFO        "CST6"
#define NTP_SERVER_1   "pool.ntp.org"
#define NTP_SERVER_2   "time.google.com"

// ---------- Pines (ESP32-WROOM-32 DevKit V1) ---------------------------------
#define PIN_SERVO      18
#define PIN_LED_R      25
#define PIN_LED_G      26
#define PIN_LED_B      27
#define PIN_BUZZER     23

// LED RGB: 0 = cátodo común (pata larga a GND), 1 = ánodo común (pata larga a 3V3)
#define LED_COMMON_ANODE 0

// ---------- Servo ------------------------------------------------------------
#define SERVO_CLOSED_DEG   0
#define SERVO_OPEN_DEG     90
#define GATE_OPEN_MS       5000   // tiempo que el portón permanece abierto
#define SERVO_STEP_DEG     3      // movimiento por pasos para no provocar picos de corriente
#define SERVO_STEP_MS      15

// ---------- Bluetooth --------------------------------------------------------
#define BLE_DEVICE_NAME    "LlaveBLE"

// ---------- Sincronización ---------------------------------------------------
#define SYNC_INTERVAL_MS   15000  // cada cuánto se consulta la lista de revocación
