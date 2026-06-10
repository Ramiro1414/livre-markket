process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/infracciones.key'),
  cert: fs.readFileSync('./certs/infracciones.crt')
};

const bus = new EventEmitter();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/infracciones', (req, res) => {

  const { evento } = req.body;

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  bus.emit(evento, req.body);
});

bus.on('producto_reservado', async (payload) => {

  let { compra } = payload;

  const estadoValido =
    compra.estado === 'producto_reservado';

  const historialValido =
    compra.historial_estados.includes(
      'producto_reservado'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

  compra.estado = 'detectando_infracciones';

  compra.historial_estados.push('detectando_infracciones')

  compra.hasPublicacion = Math.random() > 0.7 ? true : false;

  compra.estado = 'infraccion_detectada';

  compra.historial_estados.push('infraccion_detectada');

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'infraccion_detectada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de infracciones HTTPS escuchando en puerto ${PORT}`);
});