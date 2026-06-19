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
const datos_compra = {};

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

bus.on('crear_compra', (payload, res) => {

  const { compra_id, estado_compra } = payload;

  if (findById(compra_id)) {

    return res.status(400).json({
      error: 'La compra ya existe'
    });

  }

  datos_compra[compra_id] = {
    id: compra_id,
    estado_compra
  }

  console.log('compra creada: ', datos_compra[compra_id]);

  return res.status(200).json({
    mensaje: 'Compra creada'
  });

});

bus.on('solicitar_forma_entrega', (payload, res) => {

  const { compra_id, estado_compra } = payload;

  const forma_entrega = randomFormaEntrega();

  datos_compra[compra_id] = {
	...(datos_compra[compra_id] || {}),
	id: compra_id,
	forma_entrega,
	estado_compra
  };

  console.log('datos de la compra: ', datos_compra[compra_id]);

  return res.status(200).json({
    forma_entrega
  });

});

bus.on('solicitar_forma_pago', (payload, res) => {

  const { compra_id } = payload;

  const forma_pago = randomFormaPago();

  datos_compra[compra_id] = {
	...(datos_compra[compra_id] || {}),
	id: compra_id,
	forma_pago
  };

  console.log('datos de la compra: ', datos_compra[compra_id]);

  return res.status(200).json({
    forma_pago
  });

});

bus.on('cancelar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_cancelada';

    const compraActual = findById(compra_id);

    compraActual.estado_compra = estado_compra;

    console.log('compra cancelada: ', compraActual);

    return res.status(200).json({
      compraActual
    });

  });

  bus.on('confirmar_compra', async (payload, res) => {

    const { compra_id } = payload;

    const estado_compra = 'compra_confirmada_y_en_proceso_de_envio';

    const compraActual = findById(compra_id);

    compraActual.estado_compra = estado_compra;

    console.log('compra finalizada: ', compraActual);

    return res.status(200).json({
      compraActual
    });

  });

function findById(id) {
  return datos_compra[id];
}

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
