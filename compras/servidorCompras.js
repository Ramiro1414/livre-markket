process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();

const EventEmitter = require('events');
const bus = new EventEmitter();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/compras.key'),
  cert: fs.readFileSync('./certs/compras.crt')
};

// "Base de datos" en memoria
const compras = {};
let currentId = 1;

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/compras', (req, res) => {

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

bus.on('crear_pedido', (payload, res) => {

  const { producto } = payload;

  const compra = {
    id: currentId++,
    producto,
    estado: 'pedido_generado',
    historial_estados: ['pedido_generado']
  };

  save(compra);

  res.status(200).json(compra);
});

bus.on('confirmar_compra', async (payload, res) => {

  const { compra_id } = payload;

  const compra = findById(compra_id);

  compra.estado = 'compra_confirmada'

  console.log('payload:', payload);
  console.log('compra:', compra);

  save(compra);

  return res.status(200).json({
    compra
  });

});

bus.on('cancelar_compra', async (payload, res) => {

  //const estado = 'compra_cancelada';
  const { compra } = payload;

  console.log('payload:', payload);
  console.log('compra:', compra);

  save(compra);

  return res.status(200).json({
    compra
  });

});

bus.on('finalizar_compra', async (payload, res) => {

  //const estado = 'compra_confirmada_y_en_proceso_de_envio';
  const { compra } = payload;

  console.log('payload:', payload);
  console.log('compra:', compra);

  save(compra);

  return res.status(200).json({
    compra
  });

});

// ======= funciones helpers =======
function save(compra) {

  compras[compra.id] = {
    ...(compras[compra.id] || {}),
    ...compra
  };

}

function findById(id) {
  return compras[id];
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de compras HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de compras HTTP escuchando en puerto ${PORT}`);
});
