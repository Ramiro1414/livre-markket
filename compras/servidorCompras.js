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

  const compraActual = findById(compra_id);

  if (mensajeDuplicado(compraActual, 'compra_confirmada')) {
    
    return res.status(400).json({
      error: 'La compra ya se encuentra confirmada'
    });

  }

  if (!tieneEstado(compraActual, 'pedido_generado')) {

    return res.status(400).json({
      error: 'No se genero un pedido para la compra indicada (falta estado: pedido_generado)'
    });

  }

  const estado = 'compra_confirmada';

  const compraActualizada = {
    ...compraActual,
    estado,
    historial_estados: [
      ...(compraActual.historial_estados || []),
      estado
    ]
  };

  save(compraActualizada);

  console.log(
    'compra confirmada:',
    compras[compra_id]
  );

  return res.status(200).json({
    compra: compras[compra_id]
  });

});

bus.on('cancelar_compra', async (payload, res) => {

  const { compra } = payload;

  const compraActual = findById(compra.id);

  if (mensajeDuplicado(compraActual, 'compra_cancelada')) {
    
    return res.status(400).json({
      error: 'La compra ya se encuentra cancelada'
    });

  }

  if (!tieneEstado(compraActual, 'pedido_generado')) {

    return res.status(400).json({
      error: 'No se genero un pedido para la compra indicada (falta estado: pedido_generado)'
    });

  }

  const estado = 'compra_cancelada';

  const compraActualizada = {
    ...compraActual,
    ...compra,
    estado,
    historial_estados: [
      ...(compraActual.historial_estados || []),
      estado
    ]
  };

  save(compraActualizada);

  console.log(
    'compra cancelada:',
    compras[compra.id]
  );

  return res.status(200).json({
    compra: compras[compra.id]
  });

});

bus.on('finalizar_compra', async (payload, res) => {

  const { compra } = payload;

  const compraActual = findById(compra.id);

  if (mensajeDuplicado(compraActual, 'compra_confirmada_y_en_proceso_de_envio')) {
    
    return res.status(400).json({
      error: 'La compra ya se encuentra finalizada'
    });

  }

  if (!tieneEstado(compraActual, 'pedido_generado') && !tieneEstado(compraActual, 'compra_confirmada')) {

    return res.status(400).json({
      error: 'Compra invalida por falta de estados previos (falta estado: pedido_generado o compra_confirmada)'
    });

  }

  const estado = 'compra_confirmada_y_en_proceso_de_envio';

  const compraActualizada = {
    ...compraActual,
    ...compra,
    estado,
    historial_estados: [
      ...(compraActual.historial_estados || []),
      estado
    ]
  };

  save(compraActualizada);

  console.log(
    'compra confirmada y en proceso de envio:',
    compras[compra.id]
  );

  return res.status(200).json({
    compra: compras[compra.id]
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

function tieneEstado(compra, estado) {
  return compra.historial_estados?.includes(estado);
}

function mensajeDuplicado(compra, estado) {
  return (compra && compra.historial_estados?.includes(estado));
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de compras HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de compras HTTP escuchando en puerto ${PORT}`);
});
