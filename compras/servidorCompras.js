const express = require('express');
const app = express();

const EventEmitter = require('events');
const bus = new EventEmitter();

const ComprasService = require('./servicios/compras');

app.use(express.json());

const comprasService = new ComprasService();

// "Base de datos" en memoria
const compras = {};
let currentId = 1;

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint para eventos
app.post('/compras', (req, res) => {

  const { evento } = req.body;

  // Emitir evento interno
  bus.emit(evento, req.body);

  return res.status(200).json({
    mensaje: 'Evento recibido'
  });
});

// Listeners de eventos
bus.on('producto_seleccionado', async (payload) => {

  const { producto } = payload;

  const compra = {
    id: currentId++,
    producto,
    estado: 'pedido_generado',
    historial_estados: ['pedido_generado']
  };

  compras[compra.id] = compra;

  console.log(`Nuevo pedido generado`);

  // Emitir evento a Publicaciones
  await fetch('http://publicaciones:3000/publicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      evento: 'nuevo_pedido_creado',
      compra
    })
  });

});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de compras escuchando en puerto ${PORT}`);
});