import { Injectable, signal } from '@angular/core';
import { b64url } from './bytes';
import { Credential, StoredKey } from './models';

const DB_NAME = 'llaveble';
const STORE = 'keys';

/**
 * Guarda las llaves del invitado en IndexedDB.
 * La llave privada es un CryptoKey NO exportable: el navegador puede usarla para firmar,
 * pero nadie (ni esta app) puede leer sus bytes.
 */
@Injectable({ providedIn: 'root' })
export class KeystoreService {
  readonly keys = signal<StoredKey[]>([]);
  private dbPromise?: Promise<IDBDatabase>;

  constructor() {
    this.refresh();
  }

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'serial' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async refresh() {
    try {
      const all = await this.tx('readonly', (s) => s.getAll() as IDBRequest<StoredKey[]>);
      this.keys.set(all.sort((a, b) => b.savedAt - a.savedAt));
    } catch {
      this.keys.set([]);
    }
  }

  /** Genera el par de llaves del invitado (P-256). Devuelve la pública en base64url (65 bytes). */
  async generateKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyB64: string }> {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    return { privateKey: pair.privateKey, publicKeyB64: b64url(raw) };
  }

  async save(token: string, credential: Credential, privateKey: CryptoKey) {
    const key: StoredKey = {
      serial: credential.serial,
      gateId: credential.gateId,
      guestName: credential.guestName,
      token,
      privateKey,
      credential,
      savedAt: Date.now(),
    };
    await this.tx('readwrite', (s) => s.put(key));
    await this.refresh();
  }

  async remove(serial: number) {
    await this.tx('readwrite', (s) => s.delete(serial));
    await this.refresh();
  }
}
