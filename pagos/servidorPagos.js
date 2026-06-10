process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/pagos.key'),
  cert: fs.readFileSync('./certs/pagos.crt')
};

const bus = new EventEmitter();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/pagos', (req, res) => {

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

bus.on('compra_confirmada', async (payload) => {

  let { compra } = payload;

  const estadoValido =
    compra.estado === 'compra_confirmada';

  const historialValido =
    compra.historial_estados.includes(
      'compra_confirmada'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

  compra.estado = 'autorizando_pago';

  compra.historial_estados.push('autorizando_pago');

  compra.estado_pago =
    Math.random() > 0.7 ? 'rechazado' : 'aprobado';

  if (compra.estado_pago === 'rechazado') {

    try {

      await fetch('https://compras:3000/compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evento: 'pago_rechazado',
          compra
        })
      });

    } catch (error) {

      console.log(`Error comunicando con Compras`);
    }

    return;
  }

  try {

    await fetch('https://envios:3000/envios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'pago_autorizado',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Envios`);
  }
});

bus.on('producto_reservado', async (payload) => {

  const { compra } = payload;

  const estadoValido =
    compra.estado === 'producto_reservado';

  const historialValido =
    compra.historial_estados.includes(
      'producto_reservado'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

  compra.estado = 'solicitando_forma_pago';

  compra.historial_estados.push('solicitando_forma_pago');

  try {

    await fetch('https://web:3000/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_pago_solicitada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Web`);
  }
});

bus.on('forma_pago_seleccionada', async (payload) => {

  let { compra } = payload;

  const estadoValido =
    compra.estado === 'forma_pago_seleccionada';

  const historialValido =
    compra.historial_estados.includes(
      'forma_pago_seleccionada'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_pago_seleccionada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de pagos HTTPS escuchando en puerto ${PORT}`);
});