#include "sync.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "access.h"
#include "config.h"
#include "jwt.h"
#include "store.h"

namespace netsync
{

  static void applyRevocations(const char *token)
  {
    JsonDocument claims;
    bool badFormat;
    if (!jwtVerify(token, strlen(token), verifier::serverPublicKey(), claims, badFormat))
    {
      Serial.println("[sync] Lista de revocación con firma inválida: se ignora");
      return;
    }
    if (strcmp(claims["t"] | "", "rev") != 0 || strcmp(claims["gid"] | "", GATE_ID) != 0)
      return;
    JsonArray arr = claims["rev"].as<JsonArray>();
    uint32_t list[MAX_REVOKED];
    size_t n = 0;
    for (JsonVariant v : arr)
    {
      if (n >= MAX_REVOKED)
        break;
      list[n++] = v.as<uint32_t>();
    }
    store::updateRevocations(claims["ver"] | 0u, list, n);
  }

  static bool syncOnce()
  {
    static AccessEvent batch[MAX_EVENTS];
    size_t count = store::copyEvents(batch, MAX_EVENTS);

    JsonDocument body;
    body["ver"] = store::revocationVersion();
    JsonArray evs = body["events"].to<JsonArray>();
    for (size_t i = 0; i < count; i++)
    {
      JsonObject e = evs.add<JsonObject>();
      e["ts"] = batch[i].ts;
      if (batch[i].sn)
        e["sn"] = batch[i].sn;
      if (batch[i].sub[0])
        e["sub"] = batch[i].sub;
      e["code"] = batch[i].code;
    }
    String payload;
    serializeJson(body, payload);

    String url = String(SERVER_URL) + "/api/device/" + GATE_ID + "/sync";
    HTTPClient http;
    WiFiClient plain;
    WiFiClientSecure secure;
    bool ok = false;
    if (url.startsWith("https://"))
    {
      secure.setInsecure(); // demo: el contenido de la respuesta va firmado y se verifica abajo
      ok = http.begin(secure, url);
    }
    else
    {
      ok = http.begin(plain, url);
    }
    if (!ok)
      return false;
    http.setTimeout(5000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_KEY);
    int status = http.POST(payload);
    if (status == 200)
    {
      store::dropEvents(count);
      JsonDocument resp;
      if (!deserializeJson(resp, http.getString()))
        applyRevocations(resp["rev"] | "");
    }
    else
    {
      Serial.printf("[sync] Error HTTP %d al sincronizar\n", status);
    }
    http.end();
    return status == 200;
  }

  static void task(void *)
  {
    uint32_t lastSync = 0;
    bool first = true;
    for (;;)
    {
      if (WiFi.status() != WL_CONNECTED)
      {
        vTaskDelay(pdMS_TO_TICKS(500));
        continue;
      }
      if (first || millis() - lastSync >= SYNC_INTERVAL_MS)
      {
        first = false;
        lastSync = millis();
        syncOnce();
      }
      vTaskDelay(pdMS_TO_TICKS(250));
    }
  }

  void begin()
  {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    configTzTime(TZ_INFO, NTP_SERVER_1, NTP_SERVER_2); // SNTP corre solo cuando hay red
    Serial.printf("[wifi] Conectando a \"%s\"...\n", WIFI_SSID);
    xTaskCreatePinnedToCore(task, "sync", 8192, nullptr, 1, nullptr, 1);
  }

  bool wifiConnected() { return WiFi.status() == WL_CONNECTED; }

} // namespace netsync
