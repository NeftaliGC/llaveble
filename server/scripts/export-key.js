// Imprime la llave pública del servidor en el formato que usa el firmware.
import { loadKeys, publicKeyForFirmware } from '../src/keys.js';
await loadKeys();
console.log(publicKeyForFirmware());
