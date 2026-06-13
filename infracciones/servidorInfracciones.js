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

  // res.status(200).json({
  //   mensaje: 'Evento recibido'
  // });

  bus.emit(evento, req.body, res);
});

bus.on('detectar_infracciones', async (payload, res) => {

  const hasPublicacion = randomInfraccion();

  return res.status(200).json({
    hasPublicacion
  });

});

function randomInfraccion() {

  hasPublicacion = Math.random() > 0.7 ? true : false;

  return hasPublicacion;

}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de infracciones HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de infracciones HTTP escuchando en puerto ${PORT}`);
});