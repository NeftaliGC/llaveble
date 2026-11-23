import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';

const ownerGuard = () => inject(AuthService).isLoggedIn() || inject(Router).parseUrl('/login');

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.HomePage), title: 'LlaveBLE' },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginPage), title: 'Entrar · LlaveBLE' },
  { path: 'panel', canActivate: [ownerGuard], loadComponent: () => import('./pages/panel').then((m) => m.PanelPage), title: 'Panel · LlaveBLE' },
  { path: 'invitacion/:code', loadComponent: () => import('./pages/invitation').then((m) => m.InvitationPage), title: 'Invitación · LlaveBLE' },
  { path: 'abrir', loadComponent: () => import('./pages/open').then((m) => m.OpenPage), title: 'Mis llaves · LlaveBLE' },
  { path: '**', redirectTo: '' },
];
