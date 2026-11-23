import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BleError, BleService, OpenStep } from '../core/ble.service';
import { RESULT_MESSAGES, describeDays } from '../core/codes';
import { KeystoreService } from '../core/keystore.service';
import { StoredKey } from '../core/models';

const STEP_TEXT: Record<OpenStep, string> = {
  scan: 'Elige el portón en la lista…',
  connect: 'Conectando por Bluetooth…',
  challenge: 'Firmando el reto del portón…',
  send: 'Enviando tu llave…',
  verify: 'El portón está verificando…',
};

interface Outcome { ok: boolean; text: string; code?: string }

@Component({
  selector: 'app-open',
  imports: [RouterLink],
  template: `
    <h1>Mis llaves</h1>
    @if (!ble.supported) {
      <p class="alert warn">Este navegador no tiene Bluetooth web. Usa <strong>Chrome en Android</strong> para abrir el portón.</p>
    }

    @if (keystore.keys().length === 0) {
      <div class="card narrow center">
        <span class="big-icon">🗝️</span>
        <p>No tienes llaves en este teléfono.</p>
        <p class="muted small">Pide al dueño una invitación y ábrela en este navegador.</p>
        <a class="btn" routerLink="/">Volver al inicio</a>
      </div>
    }

    @for (k of keystore.keys(); track k.serial) {
      <div class="card key-card">
        <div class="row between">
          <div>
            <h2>{{ k.gateId }}</h2>
            <div class="muted small">{{ k.guestName }} · llave #{{ k.serial }}</div>
          </div>
          <button class="btn ghost small" (click)="remove(k)" [disabled]="busyKey() !== null">Quitar</button>
        </div>
        <div class="muted small schedule">
          {{ describe(k.credential.days) }}, {{ k.credential.timeFrom }}–{{ k.credential.timeTo }} · hasta {{ k.credential.validTo }}
        </div>

        <button class="open-btn" (click)="open(k)" [disabled]="busyKey() !== null || !ble.supported"
                [class.working]="busyKey() === k.serial"
                [class.ok]="outcomeFor(k)?.ok === true" [class.fail]="outcomeFor(k)?.ok === false">
          @if (busyKey() === k.serial) { <span class="spinner"></span> }
          @else if (outcomeFor(k)?.ok) { ✓ }
          @else { Abrir portón }
        </button>

        @if (busyKey() === k.serial) { <p class="center muted">{{ stepText() }}</p> }
        @if (outcomeFor(k); as o) {
          <p class="alert center" [class.success]="o.ok" [class.error]="!o.ok">{{ o.text }}</p>
        }
      </div>
    }
  `,
})
export class OpenPage {
  protected readonly ble = inject(BleService);
  protected readonly keystore = inject(KeystoreService);

  readonly busyKey = signal<number | null>(null);
  readonly stepText = signal('');
  readonly outcome = signal<{ serial: number; o: Outcome } | null>(null);
  describe = describeDays;

  outcomeFor(k: StoredKey): Outcome | null {
    const o = this.outcome();
    return o && o.serial === k.serial ? o.o : null;
  }

  async open(k: StoredKey) {
    this.busyKey.set(k.serial);
    this.outcome.set(null);
    try {
      const code = await this.ble.open(k, (s) => this.stepText.set(STEP_TEXT[s]));
      const ok = code === 'OK';
      if (ok) navigator.vibrate?.(120);
      this.outcome.set({ serial: k.serial, o: { ok, code, text: RESULT_MESSAGES[code] ?? `Respuesta del portón: ${code}` } });
    } catch (e) {
      const text = e instanceof BleError ? e.message : `Error de Bluetooth: ${(e as Error).message}`;
      this.outcome.set({ serial: k.serial, o: { ok: false, text } });
    } finally {
      this.busyKey.set(null);
    }
  }

  async remove(k: StoredKey) {
    if (!confirm(`¿Quitar la llave de ${k.gateId} de este teléfono? Tendrás que pedir una nueva invitación.`)) return;
    await this.keystore.remove(k.serial);
  }
}
