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

const productos = {};

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

bus.on('crear_compra', (payload, res) => {

  const { compra_id, estado_compra } = payload;

  if (findById(compra_id)) {

    return res.status(400).json({
      error: 'La compra ya existe'
    });

  }

  productos[compra_id] = {
    id: compra_id,
    estado_compra,
    historial_estados: []
  }

  console.log('compra creada: ', productos[compra_id]);

  return res.status(200).json({
    mensaje: 'Compra creada'
  });

});

bus.on('reservar_producto', (payload, res) => {

  const { compra_id, producto, estado_compra } = payload;

  const productoActual = findById(compra_id);

  if (!productoActual) {

    return res.status(400).json({
      error: 'La compra no existe'
    });

  }

  if (productoActual && (
        productoActual.estado_compra === 'compra_cancelada' ||
        productoActual.estado_compra === 'compra_confirmada_y_en_proceso_de_envio'
      )
    ) {
      return res.status(400).json({
        error: 'La compra ya finalizó'
      });
    }

  if (mensajeDuplicado(productoActual, 'producto_reservado')) {

    return res.status(400).json({
      error: 'El producto ya fue reservado'
    });
  }

  const estado_producto = 'producto_reservado';

  productos[compra_id] = {
    ...productoActual,
    producto,
    estado_producto,
    historial_estados: [...(productoActual.historial_estados || []), estado_producto]
  };

  console.log('reservando producto: ', productos[compra_id]);

  return res.status(200).json({
    estado_producto
  });

});

bus.on('cancelar_reserva_producto', async (payload, res) => {

  const { compra_id, producto } = payload;

  const productoActual = findById(compra_id);

  if (!productoActual) {

    return res.status(400).json({
      error: 'La compra no existe'
    });

  }

  if (
    productoActual.estado_compra === 'compra_cancelada' ||
    productoActual.estado_compra === 'compra_confirmada_y_en_proceso_de_envio'
  ) {
    return res.status(400).json({
      error: 'La compra ya finalizó'
    });
  }

  if (mensajeDuplicado(productoActual, 'producto_liberado')) {
    
    return res.status(400).json({
      error: 'El producto ya fue liberado'
    });
  }

  if (!tieneEstado(productoActual, 'producto_reservado')) {

    return res.status(400).json({
      error: 'El producto no fue reservado (falta estado: producto_reservado)'
    });

  }

  const estado_producto = 'producto_liberado';

  productos[compra_id].estado_producto = estado_producto;

  productos[compra_id].historial_estados.push(estado_producto);

  console.log('cancelando reserva producto: ', productos[compra_id]);

  return res.status(200).json({
    estado_producto
  });

});

bus.on('cancelar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_cancelada';

    const productoActual = findById(compra_id);

    productoActual.estado_compra = estado_compra;

    console.log('compra cancelada: ', productoActual);

    return res.status(200).json({
      productoActual
    });

  });

  bus.on('confirmar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_confirmada_y_en_proceso_de_envio';

    const productoActual = findById(compra_id);

    productoActual.estado_compra = estado_compra;

    console.log('compra finalizada: ', productoActual);

    return res.status(200).json({
      productoActual
    });

  });

// ======= funciones helpers =======
function findById(id) {
  return productos[id];
}

function tieneEstado(producto, estado) {
  return producto.historial_estados?.includes(estado);
}

function mensajeDuplicado(producto, estado) {
  return (producto && producto.historial_estados?.includes(estado));
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de publicaciones HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de publicaciones HTTP escuchando en puerto ${PORT}`);
});
