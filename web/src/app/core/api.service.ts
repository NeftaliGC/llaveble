import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { AccessEvent, Credential, GateStatus, NewInvite } from './models';

/** Agrega el token del dueño y cierra la sesión si el servidor responde 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && token && !req.url.endsWith('/auth/login')) {
        auth.clear();
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};

export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No hay conexión con el servidor.';
    return err.error?.error ?? `Error ${err.status}`;
  }
  return err instanceof Error ? err.message : String(err);
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  login(password: string) {
    return firstValueFrom(this.http.post<{ token: string }>('/api/auth/login', { password }));
  }
  logout() {
    return firstValueFrom(this.http.post('/api/auth/logout', {}));
  }
  status() {
    return firstValueFrom(this.http.get<GateStatus>('/api/status'));
  }
  credentials() {
    return firstValueFrom(this.http.get<Credential[]>('/api/credentials'));
  }
  createInvite(body: NewInvite) {
    return firstValueFrom(this.http.post<{ serial: number; inviteCode: string; inviteUrl: string }>('/api/credentials', body));
  }
  revoke(serial: number) {
    return firstValueFrom(this.http.post<Credential>(`/api/credentials/${serial}/revoke`, {}));
  }
  events(limit = 50) {
    return firstValueFrom(this.http.get<AccessEvent[]>(`/api/events?limit=${limit}`));
  }
  invite(code: string) {
    return firstValueFrom(this.http.get<Credential>(`/api/invites/${encodeURIComponent(code)}`));
  }
  claim(code: string, publicKey: string) {
    return firstValueFrom(
      this.http.post<{ token: string; credential: Credential }>(`/api/invites/${encodeURIComponent(code)}/claim`, { publicKey }),
    );
  }
}
