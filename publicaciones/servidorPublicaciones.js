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

  // res.status(200).json({
  //   mensaje: 'Evento recibido'
  // });

  bus.emit(evento, req.body, res);
});

bus.on('reservar_producto', (payload, res) => {

  const estado = 'producto_reservado';

  return res.status(200).json({
    estado
  });

});

bus.on('cancelar_reserva_producto', async (payload, res) => {

  const estado = 'producto_liberado';

  return res.status(200).json({
    estado
  });

});

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de publicaciones HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de publicaciones HTTP escuchando en puerto ${PORT}`);
});
