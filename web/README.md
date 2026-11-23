# LlaveBLE · app web (Angular)

- `npm run build` → compila en `dist/web/browser`, que sirve el servidor (`../server`).
- `npm start` → modo desarrollo en http://localhost:4200 con proxy de `/api` hacia http://localhost:3000.

Estructura:
- `src/app/core/ble.service.ts` → protocolo BLE con el portón (UUIDs en `firmware/include/protocol.h`).
- `src/app/core/keystore.service.ts` → llaves del invitado en IndexedDB (llave privada no exportable).
- `src/app/pages/` → inicio, login, panel del dueño, invitación y "Mis llaves".
