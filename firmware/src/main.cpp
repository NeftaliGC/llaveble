// ============================================================================
//  LlaveBLE - firmware del portón
//  ESP32-WROOM-32 · Arduino + NimBLE · PlatformIO
//
//  Flujo de apertura:
//   1. La app web lee el RETO (16 bytes aleatorios, un solo uso, 30 s).
//   2. Envía "<credencial JWT>.<firma del reto>" en fragmentos por AUTH.
//   3. El ESP32 verifica: firma del servidor, portón, reto, prueba del invitado,
//      vigencia, horario y revocación.
//   4. Responde el código por RESULT, abre el servo y lo anota en la bitácora.
// ============================================================================
#include <Arduino.h>
#include <WiFi.h>
#include "access.h"
#include "actuators.h"
#include "ble.h"
#include "config.h"
#include "protocol.h"
#include "store.h"
#include "sync.h"

static char request[MAX_AUTH_LEN];
static uint32_t lockedUntil = 0;
static const uint32_t FAIL_LOCK_MS = 2000; // pausa tras un intento fallido

static void handleRequest(size_t len)
{
  uint8_t chal[CHALLENGE_LEN];
  bool haveChallenge = ble::takeChallenge(chal); // se consume siempre (un solo uso)

  const char *code;
  uint32_t sn = 0;
  char sub[33] = "";

  if ((int32_t)(millis() - lockedUntil) < 0)
  {
    code = RES_RATE_LIMIT;
  }
  else
  {
    uint32_t t0 = millis();
    code = verifier::check(request, len, haveChallenge ? chal : nullptr, sn, sub);
    Serial.printf("[acceso] %s  (llave #%u, %s)  %u ms\n", code, sn, sub[0] ? sub : "-", millis() - t0);
  }

  bool ok = strcmp(code, RES_OK) == 0;
  ble::sendResult(code);
  if (strcmp(code, RES_RATE_LIMIT) != 0)
    store::logEvent(sn, sub, code);

  if (ok)
  {
    actuators::flash(actuators::Color::Green, GATE_OPEN_MS);
    actuators::soundOk();
    actuators::openGate();
  }
  else
  {
    lockedUntil = millis() + FAIL_LOCK_MS;
    actuators::flash(actuators::Color::Red, 1500);
    actuators::soundDenied();
  }
}

void setup()
{
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== LlaveBLE " FW_VERSION " ===");

  actuators::begin();
  store::begin();

  if (!verifier::begin())
  {
    // config.h sin la llave pública: parpadea en magenta y no habilita BLE
    Serial.println("[error] SERVER_PUBKEY_HEX inválida. Copia la llave que imprime el servidor en include/config.h");
    for (;;)
    {
      actuators::flash(actuators::Color::Magenta, 300);
      for (int i = 0; i < 60; i++)
      {
        actuators::update();
        delay(10);
      }
    }
  }

  netsync::begin();
  ble::begin();
  store::logEvent(0, "", "BOOT");
  actuators::soundBoot();
}

void loop()
{
  static bool wasWifi = false, wasTime = false;

  size_t len = ble::takeRequest(request, sizeof(request));
  if (len > 0)
    handleRequest(len);

  // Color de reposo: azul con teléfono conectado; amarillo si aún no hay hora; apagado en espera
  bool conn = ble::isConnected();
  bool timeOk = verifier::timeIsValid();
  actuators::setIdleColor(conn ? actuators::Color::Blue : (timeOk ? actuators::Color::Off : actuators::Color::Yellow));

  bool wifi = netsync::wifiConnected();
  if (wifi != wasWifi)
  {
    wasWifi = wifi;
    if (wifi)
      Serial.printf("[wifi] Conectado. IP %s\n", WiFi.localIP().toString().c_str());
    else
      Serial.println("[wifi] Sin conexión");
  }
  if (timeOk && !wasTime)
  {
    wasTime = true;
    time_t now = time(nullptr);
    struct tm lt;
    localtime_r(&now, &lt);
    Serial.printf("[hora] Sincronizada: %04d-%02d-%02d %02d:%02d\n", lt.tm_year + 1900, lt.tm_mon + 1, lt.tm_mday, lt.tm_hour, lt.tm_min);
  }

  actuators::update();
  delay(5);
}