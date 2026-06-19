process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/envios.key'),
  cert: fs.readFileSync('./certs/envios.crt')
};

const bus = new EventEmitter();

const envios = {};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/envios', (req, res) => {

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

  envios[compra_id] = {
    id: compra_id,
    estado_compra,
    historial_estados: []
  }

  console.log('compra creada: ', envios[compra_id]);

  return res.status(200).json({
    mensaje: 'Compra creada'
  });

});

bus.on('enviar_producto', async (payload, res) => {

  const { compra_id, producto } = payload;

  const envioActual = findById(compra_id);

  if (mensajeDuplicado(envioActual, 'producto_enviado')) {

    return res.status(400).json({
      error: `Producto ya enviado`
    });
  }

  if (!tieneEstado(envioActual, 'costo_envio_calculado')) {

    return res.status(400).json({
      error: `Costo de envio no calculado`
    });
  }

  const estado = 'producto_enviado';

  envios[compra_id].estado = estado;
  
  envios[compra_id].historial_estados.push(estado);

  console.log('producto enviado: ', envios[compra_id]);

  return res.status(200).json({
    estado
  });

});

bus.on('calcular_costo_envio', (payload, res) => {

  const { compra_id, forma_entrega, producto, estado_compra } = payload;

  const envioActual = findById(compra_id);

  if (mensajeDuplicado(envioActual, 'costo_envio_calculado')) {

    return res.status(400).json({
      error: `Costo de envio ya calculado`
    });
  }

  let costo;

  if (forma_entrega === 'correo')
    costo = randomCostoEnvio();
  else
    costo = 0;

  const estado = 'costo_envio_calculado';

  envios[compra_id] = {
    ...envioActual,
    forma_entrega,
    costo,
    producto,
    estado,
    estado_compra,
    historial_estados: [
      ...(envioActual.historial_estados || []),
      estado
    ]
  };

  console.log('envio calculado: ', envios[compra_id]);

  return res.status(200).json({
    costo
  });

});

bus.on('cancelar_compra', async (payload, res) => {

  const { compra_id } = payload;

  const estado_compra = 'compra_cancelada';

  const envioActual = findById(compra_id);

  envioActual.estado_compra = estado_compra;

  console.log('compra cancelada: ', envioActual);

  return res.status(200).json({
    envioActual
  });

});

bus.on('confirmar_compra', async (payload, res) => {

  const { compra_id } = payload;

  const estado_compra = 'compra_confirmada_y_en_proceso_de_envio';

  const envioActual = findById(compra_id);

  envioActual.estado_compra = estado_compra;

  console.log('compra finalizada: ', envioActual);

  return res.status(200).json({
    envioActual
  });

});


// ======= funciones helpers =======
function randomCostoEnvio() {
  return Math.floor(Math.random() * 1000);
}

function findById(id) {
  return envios[id];
}

function tieneEstado(envios, estado) {
  return envios.historial_estados?.includes(estado);
}

function mensajeDuplicado(envios, estado) {
  return (envios && envios.historial_estados?.includes(estado));
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de envios HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de envios HTTP escuchando en puerto ${PORT}`);
});
