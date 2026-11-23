#pragma once
#include <Arduino.h>

// Servo, LED RGB y buzzer. Todo es no bloqueante: llama a actuators::update() en loop().
namespace actuators {
enum class Color { Off, Red, Green, Blue, Yellow, Cyan, Magenta, White };

void begin();
void update();

void setIdleColor(Color c);         // color de reposo (p. ej. azul con un teléfono conectado)
void flash(Color c, uint32_t ms);   // color temporal

void openGate();                    // abre, espera GATE_OPEN_MS y cierra
bool gateBusy();

void soundOk();
void soundDenied();
void soundBoot();
}
