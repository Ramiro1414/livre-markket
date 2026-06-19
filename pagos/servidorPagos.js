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

const pagos = {};

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

  // res.status(200).json({
  //   mensaje: 'Evento recibido'
  // });

  bus.emit(evento, req.body, res);
});

bus.on('autorizar_pago', async (payload, res) => {

  const { compra_id, estado_compra } = payload;

  if (existePago(compra_id)) {
    return res.status(400).json({
      error: 'Ya se autorizo un pago para esta compra'
    });
  }

  const estado_pago = randomEstadoPago();

  pagos[compra_id] = {id: compra_id, estado_pago, estado_compra};

  console.log('autorizando pago: ', pagos[compra_id]);

  return res.status(200).json({
    estado_pago
  });

});

bus.on('cancelar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_cancelada';

    const pagoActual = findById(compra_id);

    pagoActual.estado_compra = estado_compra;

    console.log('compra cancelada: ', pagoActual);

    return res.status(200).json({
      pagoActual
    });

  });

  bus.on('confirmar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_confirmada_y_en_proceso_de_envio';

    const pagoActual = findById(compra_id);

    pagoActual.estado_compra = estado_compra;

    console.log('compra finalizada: ', pagoActual);

    return res.status(200).json({
      pagoActual
    });

  });

function randomEstadoPago() {

  estado_pago = Math.random() > 0.7 ? 'rechazado' : 'autorizado';

  return estado_pago;

}

// funcion que actua como find or create, porque si hay infraccion, nunca se autorizo un pago, y no hay registro del mismo
function findById(id) {
  if (!pagos[id]) {
    pagos[id] = {
    id
    };
  }

  return pagos[id];
}

function existePago(compra_id) {
  return pagos[compra_id] !== undefined;
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de pagos HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de pagos HTTP escuchando en puerto ${PORT}`);
});
