import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { BleService } from '../core/ble.service';
import { describeDays } from '../core/codes';
import { KeystoreService } from '../core/keystore.service';
import { Credential } from '../core/models';

@Component({
  selector: 'app-invitation',
  imports: [RouterLink],
  template: `
    <div class="card narrow">
      @if (loading()) {
        <p class="muted">Cargando invitación…</p>
      } @else if (invite(); as inv) {
        <span class="big-icon">🎟️</span>
        <h1>Hola, {{ inv.guestName }}</h1>
        <p>Te invitaron a abrir el portón <strong>{{ inv.gateId }}</strong>.</p>
        <dl class="facts">
          <dt>Vigencia</dt><dd>{{ inv.validFrom }} al {{ inv.validTo }}</dd>
          <dt>Días</dt><dd>{{ describe(inv.days) }}</dd>
          <dt>Horario</dt><dd>{{ inv.timeFrom }} a {{ inv.timeTo }}</dd>
        </dl>

        @if (!ble.supported) {
          <p class="alert warn">Este navegador no tiene Bluetooth web. Para abrir el portón usa <strong>Chrome en Android</strong>.</p>
        }

        @if (inv.status === 'pending') {
          <p class="muted small">Al activarla, este teléfono crea una llave privada que nunca sale de él. Solo este teléfono podrá usar la invitación.</p>
          @if (error()) { <p class="alert error">{{ error() }}</p> }
          <button class="btn primary block" (click)="activate()" [disabled]="busy()">{{ busy() ? 'Activando…' : 'Activar mi llave' }}</button>
        } @else {
          <p class="alert warn">Esta invitación ya fue usada o no está disponible ({{ inv.status }}).</p>
          <a class="btn block" routerLink="/abrir">Ir a mis llaves</a>
        }
      } @else {
        <h1>Invitación no válida</h1>
        <p class="alert error">{{ error() }}</p>
      }
    </div>
  `,
})
export class InvitationPage implements OnInit {
  readonly code = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly keystore = inject(KeystoreService);
  private readonly router = inject(Router);
  protected readonly ble = inject(BleService);

  readonly invite = signal<Credential | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  describe = describeDays;

  async ngOnInit() {
    try {
      this.invite.set(await this.api.invite(this.code()));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async activate() {
    this.busy.set(true);
    this.error.set('');
    try {
      const { privateKey, publicKeyB64 } = await this.keystore.generateKeyPair();
      const { token, credential } = await this.api.claim(this.code(), publicKeyB64);
      await this.keystore.save(token, credential, privateKey);
      this.router.navigateByUrl('/abrir');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
