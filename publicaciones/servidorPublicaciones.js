process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();
app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/publicaciones.key'),
  cert: fs.readFileSync('./certs/publicaciones.crt')
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
const nombre = 'publicaciones'
const password = '111111111'

const bus = new EventEmitter();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/publicaciones', async (req, res) => {

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

  // Verificar listeners
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

  // Emitir evento interno
  bus.emit(evento, req.body, res);
});

const compras = {};

bus.on('compra_cancelada', async (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

bus.on('compra_confirmada_en_proceso_de_envio', async (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

bus.on('pedido_cancelado', async (payload) => {

  let { compra } = payload;

  compra.estado = 'reserva_producto_cancelada';

  compra.historial_estados.push('reserva_producto_cancelada');

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'reserva_producto_cancelada',
        compra,
        nombre: nombre,
        password: password
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

bus.on('nuevo_pedido_creado', (payload) => {

  const { compra } = payload;

  compra.estado = 'producto_reservado';

  compra.historial_estados.push('producto_reservado');

  const evento = {
    evento: 'producto_reservado',
    compra,
    nombre: nombre,
    password: password
  };

  fetch('https://envios:3000/envios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Envios`);
  });

  fetch('https://pagos:3000/pagos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Pagos`);
  });

  fetch('https://infracciones:3000/infracciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Infracciones`);
  });

});

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de publicaciones HTTPS escuchando en puerto ${PORT}`);
});