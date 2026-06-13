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

    await fetch('http://wso2-mi:8290/iniciar-compra', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        producto
      })
    });

    return res.status(200).json({
      mensaje: 'Compra iniciada'
    });

  } catch (error) {

    return res.status(500).json({
      error: 'Error comunicando con ESB'
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

  // res.status(200).json({
  //   mensaje: 'Evento recibido'
  // });

  bus.emit(evento, req.body, res);
});

bus.on('solicitar_forma_entrega', (payload, res) => {

  const forma_entrega = randomFormaEntrega();

  return res.status(200).json({
    forma_entrega
  });

});

bus.on('solicitar_forma_pago', (payload, res) => {

  const forma_pago = randomFormaPago();

  return res.status(200).json({
    forma_pago
  });

});

function randomFormaEntrega() {

  const opciones = ['correo', 'retira'];

  return opciones[Math.floor(Math.random() * opciones.length)];
}

function randomFormaPago() {

  const opciones = ['tarjeta', 'efectivo'];

  return opciones[Math.floor(Math.random() * opciones.length)];
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor web HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor web HTTP escuchando en puerto ${PORT}`);
});