const express = require('express');
const EventEmitter = require('events');

const app = express();
app.use(express.json());

// =========================================
// Event Bus interno
// =========================================

const bus = new EventEmitter();

// =========================================
// Listener: nuevo_pedido_creado
// =========================================

bus.on('nuevo_pedido_creado', async (payload) => {

  const { compra } = payload;

  console.log(`Reservando producto para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'producto_reservado';

  compra.historial_estados.push('producto_reservado');

  console.log(`Producto reservado para compra ${compra.id}`);

  // ==========================================
  // fan-out
  // ==========================================

  const body = JSON.stringify({
    evento: 'producto_reservado',
    compra
  });

  try {

    await Promise.all([

      fetch('http://envios:3000/envios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      }),

      fetch('http://pagos:3000/pagos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      }),

      fetch('http://infracciones:3000/infracciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      })

    ]);

    console.log(`Fan-out completado para compra ${compra.id}`);

  } catch (error) {

    console.log(`Error durante fan-out para compra ${compra.id}`);
  }
});

// =========================================
// Endpoint único
// =========================================

app.post('/publicaciones', async (req, res) => {

  const { evento } = req.body;

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

app.listen(PORT, () => {
  console.log(`Servidor Publicaciones escuchando en puerto ${PORT}`);
});