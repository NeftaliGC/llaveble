import { Injectable } from '@angular/core';
import { concatBytes, b64url, dataViewBytes } from './bytes';
import { StoredKey } from './models';

// Deben coincidir con firmware/include/protocol.h
export const SERVICE_UUID = '4c4c0000-a5e2-4b1a-9c3e-6c6c61766542';
const CHR_INFO = '4c4c0001-a5e2-4b1a-9c3e-6c6c61766542';
const CHR_CHALLENGE = '4c4c0002-a5e2-4b1a-9c3e-6c6c61766542';
const CHR_AUTH = '4c4c0003-a5e2-4b1a-9c3e-6c6c61766542';
const CHR_RESULT = '4c4c0004-a5e2-4b1a-9c3e-6c6c61766542';
const PROOF_DOMAIN = 'LLAVEBLE1';
const CHUNK_FIRST = 0x01;
const CHUNK_LAST = 0x02;
// 19 bytes de datos + 1 de banderas = 20 (cabe en el MTU mínimo de BLE, 23)
const CHUNK_DATA = 19;
const RESULT_TIMEOUT_MS = 10000;

export type OpenStep = 'scan' | 'connect' | 'challenge' | 'send' | 'verify';

export class BleError extends Error {}

@Injectable({ providedIn: 'root' })
export class BleService {
  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Flujo completo de apertura:
   * leer reto → firmarlo con la llave privada del invitado → enviar "<jwt>.<firma>" → esperar resultado.
   */
  async open(key: StoredKey, onStep: (s: OpenStep) => void): Promise<string> {
    if (!this.supported) throw new BleError('Este navegador no soporta Bluetooth. Usa Chrome en Android.');

    onStep('scan');
    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
    } catch (e) {
      throw new BleError((e as Error).name === 'NotFoundError' ? 'No se seleccionó ningún portón.' : (e as Error).message);
    }

    onStep('connect');
    const server = await device.gatt!.connect();
    try {
      const svc = await server.getPrimaryService(SERVICE_UUID);
      const info = await svc.getCharacteristic(CHR_INFO);
      const chal = await svc.getCharacteristic(CHR_CHALLENGE);
      const auth = await svc.getCharacteristic(CHR_AUTH);
      const result = await svc.getCharacteristic(CHR_RESULT);

      const gate = JSON.parse(new TextDecoder().decode(dataViewBytes(await info.readValue())));
      if (gate.gid !== key.gateId) throw new BleError(`Este portón es "${gate.gid}" y tu llave es para "${key.gateId}".`);

      // Suscribirse antes de enviar para no perder la notificación
      await result.startNotifications();
      const resultCode = new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new BleError('El portón no respondió a tiempo.')), RESULT_TIMEOUT_MS);
        result.addEventListener('characteristicvaluechanged', (ev) => {
          const value = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
          clearTimeout(timer);
          resolve(new TextDecoder().decode(dataViewBytes(value)));
        }, { once: true });
      });

      onStep('challenge');
      const challenge = dataViewBytes(await chal.readValue());
      const msg = concatBytes(new TextEncoder().encode(PROOF_DOMAIN + key.gateId), new Uint8Array([0]), challenge);
      const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, msg));

      onStep('send');
      const payload = new TextEncoder().encode(`${key.token}.${b64url(sig)}`);
      for (let off = 0; off < payload.length; off += CHUNK_DATA) {
        const part = payload.subarray(off, off + CHUNK_DATA);
        let flags = 0;
        if (off === 0) flags |= CHUNK_FIRST;
        if (off + CHUNK_DATA >= payload.length) flags |= CHUNK_LAST;
        await auth.writeValueWithResponse(concatBytes(new Uint8Array([flags]), part));
      }

      onStep('verify');
      return await resultCode;
    } finally {
      if (server.connected) server.disconnect();
    }
  }
}
