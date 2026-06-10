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

const bus = new EventEmitter();

const compras = {};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/publicaciones', async (req, res) => {

  const { evento } = req.body;

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({

      error: `Evento no soportado: ${evento}`

    });

  }

  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  bus.emit(evento, req.body, res);
});

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

  const estadoValido =
    compra.estado === 'pedido_cancelado';

  const historialValido =
    compra.historial_estados.includes(
      'pedido_cancelado'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

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
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

bus.on('nuevo_pedido_creado', (payload) => {

  const { compra } = payload;

  const estadoValido =
    compra.estado === 'pedido_generado';

  const historialValido =
    compra.historial_estados.includes(
      'pedido_generado'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

  compra.estado = 'producto_reservado';

  compra.historial_estados.push('producto_reservado');

  const evento = {
    evento: 'producto_reservado',
    compra
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