import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import './db.js';
import { loadKeys, publicKeyForFirmware } from './keys.js';
import { owner } from './routes/owner.js';
import { invites } from './routes/invites.js';
import { device } from './routes/device.js';

await loadKeys();

const app = express();
app.set('trust proxy', true); // detrás del túnel HTTPS
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, gateId: config.gateId, time: Math.floor(Date.now() / 1000) }));
app.use('/api', owner);
app.use('/api', invites);
app.use('/api', device);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// App web compilada (Angular). Cualquier otra ruta devuelve index.html (SPA).
if (fs.existsSync(path.join(config.webDist, 'index.html'))) {
  app.use(express.static(config.webDist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res.type('text').send('LlaveBLE: compila la app web con "npm run build" dentro de /web para servirla aquí.'),
  );
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`\nLlaveBLE escuchando en http://0.0.0.0:${config.port}`);
  console.log(`Portón: ${config.gateId}`);
  console.log('\nPega esta línea en firmware/include/config.h:');
  console.log(publicKeyForFirmware() + '\n');
});
