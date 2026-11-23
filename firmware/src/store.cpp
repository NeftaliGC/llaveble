#include "store.h"
#include <Preferences.h>
#include <time.h>

static SemaphoreHandle_t mtx;
static Preferences prefs;

static uint32_t revVer = 0;
static uint32_t revList[MAX_REVOKED];
static size_t revCount = 0;

static AccessEvent events[MAX_EVENTS];
static size_t evHead = 0, evCount = 0;  // cola circular

namespace store {

void begin() {
  mtx = xSemaphoreCreateMutex();
  prefs.begin("llaveble", false);
  revVer = prefs.getUInt("rev_ver", 0);
  revCount = prefs.getBytes("rev_list", revList, sizeof(revList)) / sizeof(uint32_t);
  Serial.printf("[store] Lista de revocación v%u con %u llaves\n", revVer, (unsigned)revCount);
}

bool isRevoked(uint32_t sn) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  bool found = false;
  for (size_t i = 0; i < revCount; i++) if (revList[i] == sn) { found = true; break; }
  xSemaphoreGive(mtx);
  return found;
}

uint32_t revocationVersion() { return revVer; }

bool updateRevocations(uint32_t version, const uint32_t* serials, size_t count) {
  if (version < revVer) return false;
  if (count > MAX_REVOKED) count = MAX_REVOKED;
  xSemaphoreTake(mtx, portMAX_DELAY);
  bool changed = version != revVer || count != revCount || memcmp(serials, revList, count * sizeof(uint32_t)) != 0;
  if (changed) {
    memcpy(revList, serials, count * sizeof(uint32_t));
    revCount = count;
    revVer = version;
    prefs.putUInt("rev_ver", revVer);
    prefs.putBytes("rev_list", revList, revCount * sizeof(uint32_t));
  }
  xSemaphoreGive(mtx);
  if (changed) Serial.printf("[store] Revocaciones actualizadas: v%u, %u llaves\n", revVer, (unsigned)revCount);
  return changed;
}

void logEvent(uint32_t sn, const char* sub, const char* code) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  size_t idx = (evHead + evCount) % MAX_EVENTS;
  if (evCount == MAX_EVENTS) evHead = (evHead + 1) % MAX_EVENTS;  // descarta el más viejo
  else evCount++;
  AccessEvent& e = events[idx];
  e.ts = (uint32_t)time(nullptr);
  e.sn = sn;
  strlcpy(e.sub, sub ? sub : "", sizeof(e.sub));
  strlcpy(e.code, code, sizeof(e.code));
  xSemaphoreGive(mtx);
}

size_t copyEvents(AccessEvent* out, size_t max) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  size_t n = evCount < max ? evCount : max;
  for (size_t i = 0; i < n; i++) out[i] = events[(evHead + i) % MAX_EVENTS];
  xSemaphoreGive(mtx);
  return n;
}

void dropEvents(size_t count) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  if (count > evCount) count = evCount;
  evHead = (evHead + count) % MAX_EVENTS;
  evCount -= count;
  xSemaphoreGive(mtx);
}

}  // namespace store
