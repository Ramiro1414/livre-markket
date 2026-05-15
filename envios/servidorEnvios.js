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

bus.on('pago_autorizado', async (payload) => {

  let { compra } = payload;

  console.log(`Enviando producto para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'enviando_producto';

  compra.historial_estados.push('enviando_producto');

  console.log(`Producto enviado para compra ${compra.id}`);

  // ==========================================
  // evento hacia Compras
  // ==========================================

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'producto_enviado',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

// ==================================================
// producto_reservado
// ==================================================

bus.on('producto_reservado', async (payload) => {

  const { compra } = payload;

  console.log(`Solicitud de forma de entrega para compra ${compra.id}`);

  try {

    await fetch('https://web:3000/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_entrega_solicitada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Web`);
  }
});

// ==================================================
// forma_entrega_seleccionada
// ==================================================

bus.on('forma_entrega_seleccionada', async (payload) => {

  let { compra } = payload;

  console.log(`Forma de entrega seleccionada para compra ${compra.id}: ${compra.forma_entrega}`);

  compra.estado = 'forma_entrega_seleccionada';

  compra.historial_estados.push('forma_entrega_seleccionada');

  // ==========================================
  // lógica de negocio
  // ==========================================

  if (compra.forma_entrega === 'correo')
    compra.costo = Math.floor(Math.random() * 1000);
  else
    compra.costo = 0;

  compra.estado = 'envio_calculado';

  compra.historial_estados.push('envio_calculado');

  console.log(`Costo de envío calculado para compra ${compra.id}: ${compra.costo}`);

  // ==========================================
  // evento hacia Compras
  // ==========================================

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'envio_calculado',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

// ==================================================
// Endpoint único
// ==================================================

app.post('/envios', (req, res) => {

  const { evento } = req.body;

  // responder primero
  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  console.log(`Evento recibido: ${evento}`);

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  bus.emit(evento, req.body);
});

// ==================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================================================

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de envios HTTPS escuchando en puerto ${PORT}`);
});