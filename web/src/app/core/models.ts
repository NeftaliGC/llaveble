export type CredentialStatus = 'pending' | 'active' | 'revoked' | 'expired';

export interface Credential {
  serial: number;
  guestName: string;
  gateId: string;
  validFrom: string;
  validTo: string;
  days: number[];
  timeFrom: string;
  timeTo: string;
  status: CredentialStatus;
  inviteCode?: string | null;
  inviteUrl?: string | null;
  createdAt: number;
  claimedAt: number | null;
  revokedAt: number | null;
}

export interface NewInvite {
  guestName: string;
  validFrom: string;
  validTo: string;
  days: number[];
  timeFrom: string;
  timeTo: string;
}

export interface GateStatus {
  gateId: string;
  lastSeen: number | null;
  online: boolean;
  revocationVersion: number;
  serverTime: number;
}

export interface AccessEvent {
  id: number;
  gate_id: string;
  ts: number;
  serial: number | null;
  guest: string | null;
  code: string;
}

/** Llave guardada en el teléfono del invitado (IndexedDB). */
export interface StoredKey {
  serial: number;
  gateId: string;
  guestName: string;
  token: string;            // credencial JWT firmada por el servidor
  privateKey: CryptoKey;    // no exportable: nunca sale del navegador
  credential: Credential;
  savedAt: number;
}
