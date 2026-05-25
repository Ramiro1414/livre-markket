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

const SERVICIOS_AUTORIZADOS = {
  compras: '123456789',
  pagos: '987654321',
  envios: '555555555',
  publicaciones: '111111111',
  infracciones: '222222222',
  web: '333333333'
};

// credenciales
const nombre = 'pagos'
const password = '987654321'

const bus = new EventEmitter();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/pagos', (req, res) => {

  const { evento, nombre, password } = req.body;

  if (!nombre || !password) {
    console.log(`Credenciales faltantes en la solicitud`);
    return res.status(400).json({
      error: 'Credenciales requeridas'
    });

  }

  if (!SERVICIOS_AUTORIZADOS[nombre]) {
    console.log(`Servicio no autorizado: ${nombre}`);
    return res.status(401).json({
      error: 'Servicio no autorizado'
    });

  }

  if (SERVICIOS_AUTORIZADOS[nombre] !== password) {
    console.log(`Credenciales inválidas para el servicio: ${nombre}`);
    return res.status(401).json({
      error: 'Credenciales inválidas'
    });

  }

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  // responder primero
  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  console.log(`Credenciales validas para el servicio: ${nombre}. Procesando evento: ${evento}`);

  bus.emit(evento, req.body);
});

bus.on('compra_confirmada', async (payload) => {

  let { compra } = payload;

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
          compra,
          nombre: nombre,
          password: password
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
        compra,
        nombre: nombre,
        password: password
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Envios`);
  }
});

// ==================================================
// producto_reservado
// ==================================================

bus.on('producto_reservado', async (payload) => {

  const { compra } = payload;

  try {

    await fetch('https://web:3000/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_pago_solicitada',
        compra,
        nombre: nombre,
        password: password
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Web`);
  }
});

bus.on('forma_pago_seleccionada', async (payload) => {

  let { compra } = payload;

  compra.estado = 'forma_pago_seleccionada';

  compra.historial_estados.push('forma_pago_seleccionada');

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_pago_seleccionada',
        compra,
        nombre: nombre,
        password: password
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