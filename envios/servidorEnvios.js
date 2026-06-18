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

bus.on('enviar_producto', async (payload, res) => {

  const { compra_id, producto } = payload;

  const estado = 'producto_enviado';

  envios[compra_id].estado = estado;
  
  envios[compra_id].historial_estados.push(estado);

  console.log('producto enviado: ', envios[compra_id]);

  return res.status(200).json({
    estado
  });

});

bus.on('calcular_costo_envio', (payload, res) => {

  const { compra_id, forma_entrega, producto } = payload;

  let costo;

  if (forma_entrega === 'correo')
    costo = randomCostoEnvio();
  else
    costo = 0;

  const estado = 'costo_envio_calculado';

  envios[compra_id] = {
    id: compra_id, 
    forma_entrega, 
    costo,
    producto,
    estado,
    historial_estados: [
      estado
    ]
  };

  console.log('envio calculado: ', envios[compra_id]);

  return res.status(200).json({
    costo
  });

});

function randomCostoEnvio() {
  return Math.floor(Math.random() * 1000);
}

const PORT = 3000;
// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor de envios HTTPS escuchando en puerto ${PORT}`);
// });
app.listen(PORT, () => {
  console.log(`Servidor de envios HTTP escuchando en puerto ${PORT}`);
});
