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

const infracciones = {}

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

bus.on('crear_compra', (payload, res) => {

  const { compra_id, estado_compra } = payload;

  if (findById(compra_id)) {

    return res.status(400).json({
      error: 'La compra ya existe'
    });

  }

  infracciones[compra_id] = {
    id: compra_id,
    estado_compra
  }

  console.log('compra creada: ', infracciones[compra_id]);

  return res.status(200).json({
    mensaje: 'Compra creada'
  });

});

bus.on('detectar_infracciones', async (payload, res) => {

  const { compra_id, estado_compra } = payload;

  const hasPublicacion = randomInfraccion();

  infracciones[compra_id] = {
    ...infracciones[compra_id],
    hasPublicacion,
    estado_compra
  };

  console.log('guardando infraccion: ', infracciones[compra_id]);

  return res.status(200).json({
    hasPublicacion
  });

});

bus.on('cancelar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_cancelada';

    const infraccionActual = findById(compra_id);

    infraccionActual.estado_compra = estado_compra;

    console.log('compra cancelada: ', infraccionActual);

    return res.status(200).json({
      infraccionActual
    });

  });

  bus.on('confirmar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_confirmada_y_en_proceso_de_envio';

    const infraccionActual = findById(compra_id);

    infraccionActual.estado_compra = estado_compra;

    console.log('compra finalizada: ', infraccionActual);

    return res.status(200).json({
      infraccionActual
    });

  });

function randomInfraccion() {

  hasPublicacion = Math.random() > 0.7 ? true : false;

  return hasPublicacion;

}

function findById(id) {
  return infracciones[id];
}

function existeInfraccion(compra_id) {
  return infracciones[compra_id] !== undefined;
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de infracciones HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de infracciones HTTP escuchando en puerto ${PORT}`);
});
