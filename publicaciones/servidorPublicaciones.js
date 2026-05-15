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

// =========================================
// Event Bus interno
// =========================================

const bus = new EventEmitter();

const compras = {};

bus.on('compra_cancelada', async (payload) => {

  const { compra } = payload;

  console.log(`Guardando compra ${compra.id} en Publicaciones`);

  // ==========================================
  // guardar localmente cuando se cancela la compra
  // ==========================================

  compras[compra.id] = compra;

  console.log(`Compra ${compra.id} almacenada en Publicaciones`);
});

bus.on('compra_confirmada_en_proceso_de_envio', async (payload) => {

  const { compra } = payload;

  console.log(`Guardando compra ${compra.id} en Publicaciones`);

  // ==========================================
  // guardar localmente cuando la compra se confirmo y se envio
  // ==========================================

  compras[compra.id] = compra;

  console.log(`Compra ${compra.id} almacenada en Publicaciones`);
});

// =========================================
// Listener: pedido_cancelado
// =========================================
bus.on('pedido_cancelado', async (payload) => {

  let { compra } = payload;

  console.log(`Cancelando reserva de producto para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'reserva_producto_cancelada';

  compra.historial_estados.push('reserva_producto_cancelada');

  console.log(`Reserva cancelada para compra ${compra.id}`);

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
        evento: 'reserva_producto_cancelada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

// =========================================
// Listener: nuevo_pedido_creado
// =========================================

bus.on('nuevo_pedido_creado', (payload) => {

  const { compra } = payload;

  console.log(`Reservando producto para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'producto_reservado';

  compra.historial_estados.push('producto_reservado');

  console.log(`Producto reservado para compra ${compra.id}`);

  // ==========================================
  // evento
  // ==========================================

  const evento = {
    evento: 'producto_reservado',
    compra
  };

  // ==========================================
  // fan-out asincrónico
  // ==========================================

  fetch('https://envios:3000/envios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Envios`);
  });

  fetch('https://pagos:3000/pagos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Pagos`);
  });

  fetch('https://infracciones:3000/infracciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Infracciones`);
  });

  console.log(`Eventos emitidos para compra ${compra.id}`);
});

// =========================================
// Endpoint único
// =========================================

app.post('/publicaciones', async (req, res) => {

  const { evento } = req.body;

  // responder primero
  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  console.log(`Evento recibido: ${evento}`);

  // Verificar listeners
  if (bus.listenerCount(evento) === 0) {
    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  // Emitir evento interno
  bus.emit(evento, req.body, res);
});

// =========================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// =========================================

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de publicaciones HTTPS escuchando en puerto ${PORT}`);
});