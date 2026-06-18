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

bus.on('reservar_producto', (payload, res) => {

  const { compra_id, producto } = payload;

  const productoActual = findById(compra_id);

  if (mensajeDuplicado(productoActual, 'producto_reservado')) {
    
    return res.status(400).json({
      error: 'El producto ya fue reservado'
    });
  }

  const estado_producto = 'producto_reservado';

  productos[compra_id] = {
    id: compra_id, 
    producto, 
    estado_producto, 
    historial_estados: [
      estado_producto
    ]
  };

  console.log('reservando producto: ', productos[compra_id]);

  return res.status(200).json({
    estado_producto
  });

});

bus.on('cancelar_reserva_producto', async (payload, res) => {

  const { compra_id, producto } = payload;

  const productoActual = findById(compra_id);

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
