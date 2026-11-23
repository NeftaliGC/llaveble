#include "actuators.h"
#include "config.h"

namespace actuators {

// ---------- LEDC: canal 0 (timer 0) para el servo, canal 2 (timer 1) para el buzzer ----------
static const uint8_t SERVO_CH = 0;
static const uint8_t BUZZER_CH = 2;
static const uint32_t SERVO_FREQ = 50;     // 50 Hz = periodo de 20 ms
static const uint8_t SERVO_RES = 16;       // 16 bits

static void servoWriteDeg(int deg) {
  deg = constrain(deg, 0, 180);
  uint32_t us = map(deg, 0, 180, 500, 2400);              // pulso del SG90
  uint32_t duty = (us * ((1UL << SERVO_RES) - 1)) / 20000UL;
  ledcWrite(SERVO_CH, duty);
}

// ---------- LED ----------
static Color idleColor = Color::Off;
static Color tempColor = Color::Off;
static uint32_t tempUntil = 0;

static void ledRaw(bool r, bool g, bool b) {
#if LED_COMMON_ANODE
  r = !r; g = !g; b = !b;
#endif
  digitalWrite(PIN_LED_R, r);
  digitalWrite(PIN_LED_G, g);
  digitalWrite(PIN_LED_B, b);
}

static void ledShow(Color c) {
  switch (c) {
    case Color::Red:     ledRaw(1, 0, 0); break;
    case Color::Green:   ledRaw(0, 1, 0); break;
    case Color::Blue:    ledRaw(0, 0, 1); break;
    case Color::Yellow:  ledRaw(1, 1, 0); break;
    case Color::Cyan:    ledRaw(0, 1, 1); break;
    case Color::Magenta: ledRaw(1, 0, 1); break;
    case Color::White:   ledRaw(1, 1, 1); break;
    default:             ledRaw(0, 0, 0); break;
  }
}

// ---------- Buzzer: secuencias de notas no bloqueantes ----------
struct Note { uint16_t freq; uint16_t ms; };
static const Note OK_TUNE[]   = {{1568, 90}, {0, 50}, {2093, 140}};
static const Note DENY_TUNE[] = {{330, 450}};
static const Note BOOT_TUNE[] = {{1047, 70}, {0, 40}, {1319, 70}, {0, 40}, {1568, 90}};
static const Note* tune = nullptr;
static size_t tuneLen = 0, tuneIdx = 0;
static uint32_t noteUntil = 0;

static void play(const Note* t, size_t len) {
  tune = t; tuneLen = len; tuneIdx = 0; noteUntil = 0;
}

// ---------- Portón: abrir por pasos, esperar, cerrar por pasos ----------
enum class GateState { Closed, Opening, Open, Closing };
static GateState gate = GateState::Closed;
static int servoDeg = SERVO_CLOSED_DEG;
static uint32_t nextStep = 0, openUntil = 0;

void begin() {
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  ledShow(Color::Off);

  ledcSetup(SERVO_CH, SERVO_FREQ, SERVO_RES);
  ledcAttachPin(PIN_SERVO, SERVO_CH);
  servoWriteDeg(SERVO_CLOSED_DEG);

  ledcSetup(BUZZER_CH, 2000, 10);
  ledcAttachPin(PIN_BUZZER, BUZZER_CH);
  ledcWriteTone(BUZZER_CH, 0);
}

void setIdleColor(Color c) { idleColor = c; }

void flash(Color c, uint32_t ms) {
  tempColor = c;
  tempUntil = millis() + ms;
}

void openGate() {
  if (gate == GateState::Closed || gate == GateState::Closing) gate = GateState::Opening;
  else if (gate == GateState::Open) openUntil = millis() + GATE_OPEN_MS;  // extiende el tiempo abierto
}

bool gateBusy() { return gate != GateState::Closed; }

void soundOk()     { play(OK_TUNE, sizeof(OK_TUNE) / sizeof(Note)); }
void soundDenied() { play(DENY_TUNE, sizeof(DENY_TUNE) / sizeof(Note)); }
void soundBoot()   { play(BOOT_TUNE, sizeof(BOOT_TUNE) / sizeof(Note)); }

void update() {
  uint32_t now = millis();

  // LED
  ledShow((int32_t)(tempUntil - now) > 0 ? tempColor : idleColor);

  // Buzzer
  if (tune && (int32_t)(now - noteUntil) >= 0) {
    if (tuneIdx < tuneLen) {
      ledcWriteTone(BUZZER_CH, tune[tuneIdx].freq);
      noteUntil = now + tune[tuneIdx].ms;
      tuneIdx++;
    } else {
      ledcWriteTone(BUZZER_CH, 0);
      tune = nullptr;
    }
  }

  // Servo
  if ((int32_t)(now - nextStep) < 0) return;
  nextStep = now + SERVO_STEP_MS;
  int dir = SERVO_OPEN_DEG >= SERVO_CLOSED_DEG ? 1 : -1;
  switch (gate) {
    case GateState::Opening:
      servoDeg += dir * SERVO_STEP_DEG;
      if ((dir > 0 && servoDeg >= SERVO_OPEN_DEG) || (dir < 0 && servoDeg <= SERVO_OPEN_DEG)) {
        servoDeg = SERVO_OPEN_DEG;
        gate = GateState::Open;
        openUntil = now + GATE_OPEN_MS;
      }
      servoWriteDeg(servoDeg);
      break;
    case GateState::Open:
      if ((int32_t)(now - openUntil) >= 0) gate = GateState::Closing;
      break;
    case GateState::Closing:
      servoDeg -= dir * SERVO_STEP_DEG;
      if ((dir > 0 && servoDeg <= SERVO_CLOSED_DEG) || (dir < 0 && servoDeg >= SERVO_CLOSED_DEG)) {
        servoDeg = SERVO_CLOSED_DEG;
        gate = GateState::Closed;
      }
      servoWriteDeg(servoDeg);
      break;
    default:
      break;
  }
}

}  // namespace actuators
