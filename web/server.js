process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/web.key'),
  cert: fs.readFileSync('./certs/web.crt')
};

const bus = new EventEmitter();

const compras = {};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/simular-compra', async (req, res) => {

  const { producto } = req.body;

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'producto_seleccionado',
        producto
      })
    });

    return res.status(200).json({
      mensaje: 'Compra iniciada'
    });

  } catch (error) {

    return res.status(500).json({
      error: 'Error comunicando con Compras'
    });
  }
});

app.post('/web', (req, res) => {

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

bus.on('compra_cancelada', async (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

bus.on('compra_confirmada_en_proceso_de_envio', async (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

bus.on('forma_entrega_solicitada', async (payload) => {

  const { compra } = payload;

  compra.forma_entrega = randomFormaEntrega();

  try {

    await fetch('https://envios:3000/envios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_entrega_seleccionada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Envios`);
  }
});

bus.on('forma_pago_solicitada', async (payload) => {

  const { compra } = payload;

  compra.medio_pago =
    Math.random() > 0.5 ? 'tarjeta' : 'efectivo';
  try {

    await fetch('https://pagos:3000/pagos', {
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

    console.log(`Error comunicando con Pagos`);
  }
});

function randomFormaEntrega() {

  const opciones = ['correo', 'retira'];

  return opciones[Math.floor(Math.random() * opciones.length)];
}

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor web HTTPS escuchando en puerto ${PORT}`);
});