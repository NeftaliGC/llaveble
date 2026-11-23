import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand"><span class="logo">🔑</span> LlaveBLE</a>
      <nav>
        <a routerLink="/abrir" routerLinkActive="active">Mis llaves</a>
        <a [routerLink]="auth.isLoggedIn() ? '/panel' : '/login'" routerLinkActive="active">Panel</a>
      </nav>
    </header>
    <main class="container"><router-outlet /></main>
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
}
