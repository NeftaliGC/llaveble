// Mensajes para los códigos de resultado del portón (firmware/src/access.h)
export const RESULT_MESSAGES: Record<string, string> = {
  OK: '¡Acceso permitido! El portón se está abriendo.',
  BAD_FORMAT: 'La llave no tiene un formato válido.',
  BAD_SIGNATURE: 'La llave no fue emitida por este sistema.',
  WRONG_GATE: 'Esta llave es para otro portón.',
  BAD_CHALLENGE: 'El reto del portón expiró. Intenta de nuevo.',
  BAD_PROOF: 'Este teléfono no es el dueño de la llave.',
  NO_TIME: 'El portón todavía no tiene la hora sincronizada.',
  NOT_YET_VALID: 'Tu llave todavía no está vigente.',
  EXPIRED: 'Tu llave ya venció.',
  OUT_OF_SCHEDULE: 'Estás fuera del horario permitido.',
  REVOKED: 'Tu llave fue revocada por el dueño.',
  RATE_LIMIT: 'Demasiados intentos seguidos. Espera un momento.',
  BOOT: 'Portón encendido',
  UNKNOWN: 'Resultado desconocido',
};

export const EVENT_LABELS: Record<string, string> = {
  OK: 'Abrió',
  BAD_FORMAT: 'Formato inválido',
  BAD_SIGNATURE: 'Firma inválida',
  WRONG_GATE: 'Otro portón',
  BAD_CHALLENGE: 'Reto inválido',
  BAD_PROOF: 'Prueba inválida',
  NO_TIME: 'Sin hora',
  NOT_YET_VALID: 'Aún no vigente',
  EXPIRED: 'Vencida',
  OUT_OF_SCHEDULE: 'Fuera de horario',
  REVOKED: 'Revocada',
  BOOT: 'Portón encendido',
  UNKNOWN: 'Desconocido',
};

export const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
/** Orden de lunes a domingo para mostrar */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function describeDays(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Todos los días';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Lunes a viernes';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Fines de semana';
  return WEEK_ORDER.filter((d) => set.has(d)).map((d) => DAY_NAMES[d]).join(', ');
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activa',
  revoked: 'Revocada',
  expired: 'Vencida',
};
