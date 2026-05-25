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

const SERVICIOS_AUTORIZADOS = {
  compras: '123456789',
  pagos: '987654321',
  envios: '555555555',
  publicaciones: '111111111',
  infracciones: '222222222',
  web: '333333333'
};

// credenciales
const nombre = 'infracciones'
const password = '222222222'

const bus = new EventEmitter();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


app.post('/infracciones', (req, res) => {

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

bus.on('producto_reservado', async (payload) => {

  let { compra } = payload;

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
  console.log(`Servidor de infracciones HTTPS escuchando en puerto ${PORT}`);
});