# LlaveBLE

Control de acceso a un portón con **llaves digitales temporales**. El dueño crea invitaciones con días y horario; el invitado abre el portón desde **Chrome en Android** por Bluetooth; el **ESP32** valida todo localmente con criptografía (ECDSA P-256).

```
llaveble/
├── server/     Node.js + Express + SQLite · emite y revoca llaves (JWT ES256)
├── web/        Angular · panel del dueño + app del invitado (Web Bluetooth)
└── firmware/   PlatformIO · ESP32-WROOM-32 (Arduino + NimBLE)
```

## Cómo funciona

1. El dueño crea una invitación en el panel → se genera un enlace/QR de **un solo uso**.
2. El invitado lo abre: su navegador crea un par de llaves P-256 **no exportable** y manda solo la pública.
3. El servidor emite una **credencial JWT ES256** con: portón, vigencia, días, horario y la llave pública del invitado.
4. Para abrir, el ESP32 manda un **reto aleatorio** de 16 bytes; el teléfono lo firma y envía `<credencial>.<firma>` por BLE.
5. El ESP32 verifica la firma del servidor, el portón, el reto, la prueba del invitado, la vigencia, el horario y la lista de revocación. Si todo está bien, abre el servo.
6. Cada 15 s el ESP32 se sincroniza: envía la bitácora y recibe la **lista de revocación firmada** por el servidor.

> Abrir **no requiere internet**; solo la administración (crear/revocar) y el historial.

---

## 1. Requisitos

- **Node.js 22** o superior
- **VS Code + PlatformIO** (o `pip install platformio`)
- Un túnel HTTPS: **cloudflared** (recomendado) o **ngrok**
- Teléfono **Android con Chrome** (Web Bluetooth no existe en iPhone ni en Firefox)

## 2. Servidor + app web

```bash
# App web
cd web
npm install
npm run build          # genera web/dist, que el servidor sirve

# Servidor
cd ../server
cp .env.example .env   # cambia OWNER_PASSWORD y DEVICE_KEY
npm install
npm start
```

Al arrancar, el servidor imprime una línea así; **cópiala**, la necesitas en el firmware:

```
#define SERVER_PUBKEY_HEX "04ab12..."
```

(También con `npm run llave-publica`.) La llave del servidor se guarda en `server/data/server-key.json`; si borras esa carpeta, se genera otra y tendrás que volver a flashear el ESP32.

### Túnel HTTPS (para que el teléfono pueda usar Bluetooth)

Web Bluetooth solo funciona en páginas **https**. En otra terminal:

```bash
cloudflared tunnel --url http://localhost:3000
# o:  ngrok http 3000
```

Abre la URL `https://....trycloudflare.com` que aparece. Opcional: ponla en `PUBLIC_URL` del `.env` para que los enlaces de invitación siempre la usen.

## 3. Firmware (ESP32-WROOM-32)

1. Abre la carpeta `firmware/` en VS Code con PlatformIO.
2. Edita `include/config.h` (si no existe, copia `config.example.h`):
   - `WIFI_SSID`, `WIFI_PASSWORD` → red de **2.4 GHz**, la misma de la laptop.
   - `SERVER_URL` → `http://IP_DE_TU_LAPTOP:3000` (Windows: `ipconfig`, Linux/Mac: `ip a` / `ifconfig`).
   - `DEVICE_KEY` → igual que en `server/.env`.
   - `SERVER_PUBKEY_HEX` → la línea que imprimió el servidor.
3. Sube y abre el monitor:

```bash
pio run -t upload
pio device monitor
```

Deberías ver `[wifi] Conectado`, `[hora] Sincronizada` y `[ble] Anunciando como "LlaveBLE"`.

### Conexiones

| Componente | Pin | ESP32 |
|---|---|---|
| Servo SG90 | naranja / rojo / marrón | GPIO 18 / VIN (5 V) / GND |
| LED RGB (cátodo común) | R / G / B (con 220 Ω) / común | GPIO 25 / 26 / 27 / GND |
| Buzzer pasivo | S / + / − | GPIO 23 / 3V3 / GND |
| Capacitor 100 µF (+10 µF) | + / − | riel 5 V / GND, junto al servo |

### Qué significan las luces

| LED | Significado |
|---|---|
| Apagado | Listo, esperando |
| Azul | Teléfono conectado |
| Verde + 2 pitidos | Acceso permitido, el servo abre 5 s |
| Rojo + tono grave | Acceso negado (ver el motivo en la app o el monitor serie) |
| Amarillo | Aún no tiene la hora (revisa Wi-Fi) |
| Magenta parpadeando | Falta `SERVER_PUBKEY_HEX` en `config.h` |

## 4. Demo

1. En la laptop abre `https://<tu-túnel>/panel` y entra con `OWNER_PASSWORD`.
2. Crea una invitación (botón **Solo hoy** o **Siempre**) → aparece un QR.
3. Con el Android, escanea el QR → **Activar mi llave**.
4. Toca **Abrir portón** → elige "LlaveBLE" en la lista → el servo abre.
5. En el panel, **Revoca** la llave. Tras la siguiente sincronización (≤ 15 s), vuelve a intentar: el portón responde *"Tu llave fue revocada"*.
6. El historial del panel muestra cada intento.

## 5. Problemas comunes

| Síntoma | Solución |
|---|---|
| El ESP32 se reinicia al mover el servo | Capacitor junto al servo; otro puerto USB; o fuente de 5 V aparte uniendo GND |
| `[sync] Error HTTP -1` | IP o puerto incorrectos en `SERVER_URL`, o el firewall de la laptop bloquea el puerto 3000 |
| La app dice "no tiene Bluetooth web" | Usa Chrome en Android y entra por la URL **https** del túnel |
| `NO_TIME` | El ESP32 no ha sincronizado la hora: revisa el Wi-Fi (debe ser 2.4 GHz) |
| `OUT_OF_SCHEDULE` sin razón aparente | Revisa `TZ_INFO` (firmware) y `TZ_OFFSET` (.env): ambos deben ser la hora de México |
| `BAD_SIGNATURE` | La llave pública en `config.h` no es la del servidor actual |

## 6. Límites de esta versión (demo)

- El ESP32 habla con el servidor por HTTP en la red local. La lista de revocación va **firmada**, así que no se puede falsificar, aunque alguien podría bloquear su entrega; para producción usar HTTPS con certificado verificado.
- `DEVICE_KEY` y las credenciales Wi-Fi están en el firmware; en producción activar **Secure Boot** y **Flash Encryption**.
- La hora viene de NTP; la versión final agrega el **RTC DS3231** para funcionar sin internet.
- Un solo dueño y un solo portón.

## Pruebas realizadas

- La verificación criptográfica del firmware (`b64url`, `es256`, `jwt`, `access`) se compiló en PC contra **mbedTLS 2.28**, la misma versión de Arduino-ESP32 2.0.x. Se probó con credenciales reales del servidor y con firmas hechas por Web Crypto en Chrome: acceso válido, reto ausente o repetido, credencial alterada, prueba de otro invitado, fuera de horario, vencida, revocada y lista de revocación firmada.

## Licencia

[MIT](LICENSE)
