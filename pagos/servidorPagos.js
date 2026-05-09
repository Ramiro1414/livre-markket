const express = require('express');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const bus = new EventEmitter();

// ==========================================
// compra_confirmada
// ==========================================
bus.on('compra_confirmada', async (payload) => {

  let { compra } = payload;

  console.log(`Autorizando pago para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'autorizando_pago';

  compra.historial_estados.push('autorizando_pago');

  compra.estado_pago =
    Math.random() > 0.7 ? 'rechazado' : 'aprobado';

  // ==========================================
  // pago rechazado
  // ==========================================

  if (compra.estado_pago === 'rechazado') {

    console.log(`Pago rechazado para compra ${compra.id}`);

    try {

      await fetch('http://compras:3000/compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evento: 'pago_rechazado',
          compra
        })
      });

    } catch (error) {

      console.log(`Error comunicando con Compras`);
    }

    return;
  }

  // ==========================================
  // pago aprobado
  // ==========================================

  console.log(`Pago aprobado para compra ${compra.id}`);

  try {

    await fetch('http://envios:3000/envios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'pago_autorizado',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Envios`);
  }
});

// ==================================================
// producto_reservado
// ==================================================

bus.on('producto_reservado', async (payload) => {

  const { compra } = payload;

  console.log(`Solicitando forma de pago para compra ${compra.id}`);

  try {

    await fetch('http://web:3000/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_pago_solicitada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Web`);
  }
});

// ==================================================
// forma_pago_seleccionada
// ==================================================

bus.on('forma_pago_seleccionada', async (payload) => {

  let { compra, medio_pago } = payload;

  console.log(`Forma de pago seleccionada para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.medio_pago = medio_pago;

  compra.estado = 'forma_pago_seleccionada';

  compra.historial_estados.push('forma_pago_seleccionada');

  console.log(`Medio de pago registrado para compra ${compra.id}`);

  // ==========================================
  // evento hacia Compras
  // ==========================================

  try {

    await fetch('http://compras:3000/compras', {
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

    console.log(`Error comunicando con Compras`);
  }
});

// ==================================================
// Endpoint único
// ==================================================

app.post('/pagos', (req, res) => {

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================================================

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor Pagos escuchando en puerto ${PORT}`);
});