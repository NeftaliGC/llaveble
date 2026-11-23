import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import QRCode from 'qrcode';
import { ApiService, errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { DAY_NAMES, EVENT_LABELS, STATUS_LABELS, WEEK_ORDER, describeDays } from '../core/codes';
import { AccessEvent, Credential, GateStatus } from '../core/models';

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

@Component({
  selector: 'app-panel',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="row between">
      <h1>Panel del dueño</h1>
      <button class="btn ghost" (click)="logout()">Salir</button>
    </div>

    <!-- Estado del portón -->
    <div class="card status-card">
      <span class="dot" [class.on]="status()?.online"></span>
      <div>
        <strong>{{ status()?.gateId ?? '—' }}</strong>
        <div class="muted small">
          @if (status()?.online) { En línea · }
          @else { Sin conexión · }
          @if (status()?.lastSeen) { última sincronización {{ status()!.lastSeen! * 1000 | date: 'HH:mm:ss' }} }
          @else { nunca se ha sincronizado }
          · lista de revocación v{{ status()?.revocationVersion }}
        </div>
      </div>
    </div>

    <div class="grid2 top">
      <!-- Nueva invitación -->
      <div class="card">
        <h2>Nueva invitación</h2>
        <form (ngSubmit)="create()">
          <label>Nombre del invitado
            <input name="guestName" [(ngModel)]="form.guestName" maxlength="32" placeholder="Juan Pérez" required />
          </label>
          <div class="grid2 tight">
            <label>Desde <input type="date" name="validFrom" [(ngModel)]="form.validFrom" required /></label>
            <label>Hasta <input type="date" name="validTo" [(ngModel)]="form.validTo" required /></label>
          </div>
          <span class="label">Días permitidos</span>
          <div class="days">
            @for (d of weekOrder; track d) {
              <button type="button" class="day" [class.sel]="form.days.includes(d)" (click)="toggleDay(d)">{{ dayNames[d] }}</button>
            }
          </div>
          <div class="grid2 tight">
            <label>Hora inicio <input type="time" name="timeFrom" [(ngModel)]="form.timeFrom" required /></label>
            <label>Hora fin <input type="time" name="timeTo" [(ngModel)]="form.timeTo" required /></label>
          </div>
          <div class="presets">
            <button type="button" class="chip" (click)="preset('work')">L–V 9 a 18</button>
            <button type="button" class="chip" (click)="preset('all')">Siempre</button>
            <button type="button" class="chip" (click)="preset('today')">Solo hoy</button>
          </div>
          @if (formError()) { <p class="alert error">{{ formError() }}</p> }
          <button class="btn primary block" [disabled]="busy()">{{ busy() ? 'Creando…' : 'Crear invitación' }}</button>
        </form>
      </div>

      <!-- Invitación recién creada -->
      <div class="card">
        <h2>Compartir invitación</h2>
        @if (lastInvite(); as inv) {
          <p class="muted">Pide al invitado que escanee el código con su teléfono (Chrome en Android). El enlace solo se puede usar una vez.</p>
          <img class="qr" [src]="qr()" alt="Código QR de la invitación" />
          <input class="mono" [value]="inv.url" readonly (focus)="$any($event.target).select()" />
          <div class="row">
            <button class="btn" (click)="copy(inv.url)">{{ copied() ? '¡Copiado!' : 'Copiar enlace' }}</button>
            @if (canShare) { <button class="btn" (click)="share(inv.url, inv.name)">Compartir…</button> }
          </div>
        } @else {
          <p class="muted">Aquí aparecerá el código QR y el enlace de la invitación que crees.</p>
        }
      </div>
    </div>

    <!-- Llaves -->
    <div class="card top">
      <h2>Llaves</h2>
      @if (credentials().length === 0) { <p class="muted">Todavía no hay llaves.</p> }
      <div class="table-wrap">
        <table>
          @if (credentials().length) {
            <thead><tr><th>#</th><th>Invitado</th><th>Vigencia</th><th>Horario</th><th>Estado</th><th></th></tr></thead>
          }
          <tbody>
            @for (c of credentials(); track c.serial) {
              <tr>
                <td>{{ c.serial }}</td>
                <td>{{ c.guestName }}</td>
                <td class="small">{{ c.validFrom }} → {{ c.validTo }}</td>
                <td class="small">{{ describe(c.days) }}<br />{{ c.timeFrom }}–{{ c.timeTo }}</td>
                <td><span class="badge" [attr.data-s]="c.status">{{ statusLabels[c.status] }}</span></td>
                <td class="actions">
                  @if (c.status === 'pending' && c.inviteUrl) {
                    <button class="btn small" (click)="showInvite(c)">QR</button>
                  }
                  @if (c.status === 'active' || c.status === 'pending') {
                    <button class="btn small danger" (click)="revoke(c)">Revocar</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Historial -->
    <div class="card top">
      <h2>Historial del portón</h2>
      @if (events().length === 0) { <p class="muted">Sin eventos todavía. El portón los envía al sincronizar.</p> }
      <ul class="events">
        @for (e of events(); track e.id) {
          <li>
            <span class="badge" [attr.data-ok]="e.code === 'OK'" [attr.data-boot]="e.code === 'BOOT'">{{ eventLabel(e.code) }}</span>
            <span>{{ e.guest || (e.code === 'BOOT' ? 'Sistema' : 'Desconocido') }}@if (e.serial) { <span class="muted"> · llave #{{ e.serial }}</span> }</span>
            <span class="muted small right">{{ e.ts * 1000 | date: 'dd/MM HH:mm:ss' }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class PanelPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly dayNames = DAY_NAMES;
  readonly weekOrder = WEEK_ORDER;
  readonly statusLabels = STATUS_LABELS;
  readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  readonly status = signal<GateStatus | null>(null);
  readonly credentials = signal<Credential[]>([]);
  readonly events = signal<AccessEvent[]>([]);
  readonly lastInvite = signal<{ url: string; name: string } | null>(null);
  readonly qr = signal('');
  readonly busy = signal(false);
  readonly formError = signal('');
  readonly copied = signal(false);
  readonly activeCount = computed(() => this.credentials().filter((c) => c.status === 'active').length);

  form = this.emptyForm();
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 5000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  describe = describeDays;
  eventLabel = (code: string) => EVENT_LABELS[code] ?? code;

  private emptyForm() {
    const today = new Date();
    const week = new Date(Date.now() + 7 * 86400e3);
    return { guestName: '', validFrom: ymd(today), validTo: ymd(week), days: [1, 2, 3, 4, 5], timeFrom: '09:00', timeTo: '18:00' };
  }

  async refresh() {
    try {
      const [s, c, e] = await Promise.all([this.api.status(), this.api.credentials(), this.api.events(50)]);
      this.status.set(s);
      this.credentials.set(c);
      this.events.set(e);
    } catch { /* el interceptor maneja la sesión vencida */ }
  }

  toggleDay(d: number) {
    const set = new Set(this.form.days);
    set.has(d) ? set.delete(d) : set.add(d);
    this.form.days = [...set];
  }

  preset(kind: 'work' | 'all' | 'today') {
    const today = ymd(new Date());
    if (kind === 'work') Object.assign(this.form, { days: [1, 2, 3, 4, 5], timeFrom: '09:00', timeTo: '18:00' });
    if (kind === 'all') Object.assign(this.form, { days: [0, 1, 2, 3, 4, 5, 6], timeFrom: '00:00', timeTo: '23:59' });
    if (kind === 'today') Object.assign(this.form, { days: [new Date().getDay()], validFrom: today, validTo: today, timeFrom: '00:00', timeTo: '23:59' });
  }

  async create() {
    this.formError.set('');
    this.busy.set(true);
    try {
      const res = await this.api.createInvite(this.form);
      await this.setInvite(res.inviteUrl, this.form.guestName);
      this.form = this.emptyForm();
      await this.refresh();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async showInvite(c: Credential) {
    if (c.inviteUrl) await this.setInvite(c.inviteUrl, c.guestName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async setInvite(url: string, name: string) {
    this.lastInvite.set({ url, name });
    this.qr.set(await QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: '#1f2a24' } }));
    this.copied.set(false);
  }

  async revoke(c: Credential) {
    if (!confirm(`¿Revocar la llave de ${c.guestName}? El portón la rechazará en cuanto se sincronice.`)) return;
    try {
      await this.api.revoke(c.serial);
      await this.refresh();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async copy(text: string) {
    await navigator.clipboard.writeText(text);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  share(url: string, name: string) {
    navigator.share({ title: 'Invitación LlaveBLE', text: `${name}, aquí está tu llave para el portón:`, url }).catch(() => {});
  }

  async logout() {
    try { await this.api.logout(); } catch { /* ignorar */ }
    this.auth.clear();
    this.router.navigateByUrl('/');
  }
}
