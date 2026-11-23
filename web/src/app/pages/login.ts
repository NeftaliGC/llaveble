import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="card narrow">
      <h1>Panel del dueño</h1>
      <form (ngSubmit)="submit()">
        <label>Contraseña
          <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required />
        </label>
        @if (error()) { <p class="alert error">{{ error() }}</p> }
        <button class="btn primary block" [disabled]="busy() || !password">{{ busy() ? 'Entrando…' : 'Entrar' }}</button>
      </form>
    </div>
  `,
})
export class LoginPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  password = '';
  readonly busy = signal(false);
  readonly error = signal('');

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const { token } = await this.api.login(this.password);
      this.auth.set(token);
      this.router.navigateByUrl('/panel');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
