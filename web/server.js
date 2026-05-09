const express = require('express');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const bus = new EventEmitter();

// ==================================================
// Helpers
// ==================================================

function randomFormaEntrega() {

  const opciones = ['correo', 'retira'];

  return opciones[Math.floor(Math.random() * opciones.length)];
}

// ==================================================
// Listener: forma_entrega_solicitada
// ==================================================

bus.on('forma_entrega_solicitada', async (payload) => {

  const { compra } = payload;

  console.log(`Seleccionando forma de entrega para compra ${compra.id}`);

  compra.forma_entrega = randomFormaEntrega();

  console.log(`Forma seleccionada: ${compra.forma_entrega}`);

  try {

    await fetch('http://envios:3000/envios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_entrega_seleccionada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Envios`);
  }
});

// ==================================================
// Listener: forma_pago_solicitada
// ==================================================

bus.on('forma_pago_solicitada', async (payload) => {

  const { compra } = payload;

  console.log(`Seleccionando forma de pago para compra ${compra.id}`);

  compra.medio_pago =
    Math.random() > 0.5 ? 'tarjeta' : 'efectivo';

  console.log(`Medio de pago seleccionado: ${compra.medio_pago}`);

  try {

    await fetch('http://pagos:3000/pagos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_pago_seleccionada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Pagos`);
  }
});

// ==================================================
// Endpoint único
// ==================================================

app.post('/web', (req, res) => {

  const { evento } = req.body;

  console.log(`Evento recibido: ${evento}`);

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  bus.emit(evento, req.body);

  return res.status(200).json({
    mensaje: 'Evento recibido'
  });
});

// ==================================================
// Endpoint inicial del workflow
// ==================================================

app.post('/simular-compra', async (req, res) => {

  const { producto } = req.body;

  console.log(`Cliente seleccionó producto: ${producto}`);

  try {

    await fetch('http://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'producto_seleccionado',
        producto
      })
    });

    return res.status(200).json({
      mensaje: 'Compra iniciada'
    });

  } catch (error) {

    return res.status(500).json({
      error: 'Error comunicando con Compras'
    });
  }
});

// ==================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================================================

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor Web escuchando en puerto ${PORT}`);
});