import { Injectable, computed, signal } from '@angular/core';

const KEY = 'llaveble.ownerToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSig = signal<string | null>(this.read());
  readonly token = this.tokenSig.asReadonly();
  readonly isLoggedIn = computed(() => !!this.tokenSig());

  set(token: string) {
    this.tokenSig.set(token);
    try { localStorage.setItem(KEY, token); } catch { /* almacenamiento no disponible */ }
  }

  clear() {
    this.tokenSig.set(null);
    try { localStorage.removeItem(KEY); } catch { /* almacenamiento no disponible */ }
  }

  private read(): string | null {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
}
