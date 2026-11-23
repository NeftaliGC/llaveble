#include "ble.h"
#include <NimBLEDevice.h>
#include <esp_system.h>
#include "config.h"
#include "protocol.h"

namespace ble {

static NimBLEServer* server;
static NimBLECharacteristic* chResult;
static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

// Reto actual
static uint8_t challenge[CHALLENGE_LEN];
static uint32_t challengeAt = 0;
static bool challengeValid = false;

// Ensamblado de la solicitud fragmentada
static char rxBuf[MAX_AUTH_LEN];
static size_t rxLen = 0;
static bool rxOverflow = false;
static char reqBuf[MAX_AUTH_LEN];
static size_t reqLen = 0;      // > 0 = solicitud lista para procesar
static volatile bool connected = false;

class ServerCB : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* s, ble_gap_conn_desc* desc) override {
    connected = true;
    // Intervalo de conexión corto (7.5–15 ms) para que los fragmentos viajen rápido
    s->updateConnParams(desc->conn_handle, 6, 12, 0, 200);
    Serial.println("[ble] Teléfono conectado");
  }
  void onDisconnect(NimBLEServer* s) override {
    connected = false;
    portENTER_CRITICAL(&mux);
    challengeValid = false;
    rxLen = 0;
    portEXIT_CRITICAL(&mux);
    Serial.println("[ble] Teléfono desconectado");
    NimBLEDevice::startAdvertising();
  }
};

class ChallengeCB : public NimBLECharacteristicCallbacks {
  // Cada lectura genera un reto nuevo con el generador aleatorio por hardware
  void onRead(NimBLECharacteristic* c) override {
    uint8_t fresh[CHALLENGE_LEN];
    esp_fill_random(fresh, sizeof(fresh));
    portENTER_CRITICAL(&mux);
    memcpy(challenge, fresh, sizeof(fresh));
    challengeAt = millis();
    challengeValid = true;
    portEXIT_CRITICAL(&mux);
    c->setValue(fresh, sizeof(fresh));
  }
};

class AuthCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    std::string v = c->getValue();
    if (v.empty()) return;
    uint8_t flags = (uint8_t)v[0];
    portENTER_CRITICAL(&mux);
    if (flags & CHUNK_FIRST) { rxLen = 0; rxOverflow = false; }
    size_t n = v.size() - 1;
    if (rxLen + n <= sizeof(rxBuf)) { memcpy(rxBuf + rxLen, v.data() + 1, n); rxLen += n; }
    else rxOverflow = true;
    if ((flags & CHUNK_LAST) && reqLen == 0) {
      if (!rxOverflow) { memcpy(reqBuf, rxBuf, rxLen); reqLen = rxLen; }
      rxLen = 0;
    }
    portEXIT_CRITICAL(&mux);
  }
};

void begin() {
  NimBLEDevice::init(BLE_DEVICE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  NimBLEDevice::setMTU(247);

  server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCB());
  NimBLEService* svc = server->createService(SERVICE_UUID);

  NimBLECharacteristic* chInfo = svc->createCharacteristic(CHR_INFO_UUID, NIMBLE_PROPERTY::READ);
  String info = String("{\"gid\":\"") + GATE_ID + "\",\"fw\":\"" + FW_VERSION + "\"}";
  chInfo->setValue((const uint8_t*)info.c_str(), info.length());

  svc->createCharacteristic(CHR_CHAL_UUID, NIMBLE_PROPERTY::READ)->setCallbacks(new ChallengeCB());
  svc->createCharacteristic(CHR_AUTH_UUID, NIMBLE_PROPERTY::WRITE)->setCallbacks(new AuthCB());
  chResult = svc->createCharacteristic(CHR_RESULT_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  chResult->setValue(std::string("READY"));

  svc->start();
  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);  // el nombre va en la respuesta de escaneo (no cabe con el UUID de 128 bits)
  adv->start();
  Serial.printf("[ble] Anunciando como \"%s\"\n", BLE_DEVICE_NAME);
}

size_t takeRequest(char* out, size_t max) {
  size_t n = 0;
  portENTER_CRITICAL(&mux);
  if (reqLen > 0 && reqLen <= max) { memcpy(out, reqBuf, reqLen); n = reqLen; }
  reqLen = 0;
  portEXIT_CRITICAL(&mux);
  return n;
}

bool takeChallenge(uint8_t out[16]) {
  bool ok;
  portENTER_CRITICAL(&mux);
  ok = challengeValid && (millis() - challengeAt) < CHALLENGE_TTL_MS;
  if (ok) memcpy(out, challenge, CHALLENGE_LEN);
  challengeValid = false;  // un solo uso
  portEXIT_CRITICAL(&mux);
  return ok;
}

void sendResult(const char* code) {
  chResult->setValue((const uint8_t*)code, strlen(code));
  chResult->notify();
}

bool isConnected() { return connected; }

}  // namespace ble
