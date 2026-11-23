import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <h1>Tu teléfono es la llave</h1>
      <p class="muted">Llaves digitales temporales para el portón: con horario, revocables y con registro de cada acceso.</p>
    </section>
    <div class="grid2">
      <a class="card link-card" routerLink="/abrir">
        <span class="big-icon">📱</span>
        <h2>Soy invitado</h2>
        <p class="muted">Abre el portón con las llaves guardadas en este teléfono.</p>
      </a>
      <a class="card link-card" routerLink="/panel">
        <span class="big-icon">🛡️</span>
        <h2>Soy el dueño</h2>
        <p class="muted">Crea invitaciones, revoca llaves y revisa el historial.</p>
      </a>
    </div>
  `,
})
export class HomePage {}
