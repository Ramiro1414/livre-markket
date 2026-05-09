const express = require('express');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const bus = new EventEmitter();

// ==================================================
// verificar_infraccion
// ==================================================
bus.on('verificar_infraccion', async (payload) => {

  const { compra } = payload;

  console.log(`Verificando infracción para compra ${compra.id}`);

  if (compra.hasPublicacion) {

    console.log(`Compra ${compra.id} posee infracción`);

    try {

      await fetch('http://compras:3000/compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evento: 'existe_infraccion',
          compra
        })
      });

    } catch (error) {

      console.log(`Error comunicando con Compras`);
    }
  }

  // ==========================================
  // no existe infracción
  // ==========================================

  else {

    console.log(`Compra ${compra.id} sin infracción`);

    try {

      await fetch('http://compras:3000/compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evento: 'no_existe_infraccion',
          compra
        })
      });

    } catch (error) {

      console.log(`Error comunicando con Compras`);
    }
  }
});

// ==================================================
// producto_reservado
// ==================================================

bus.on('producto_reservado', async (payload) => {

  let { compra } = payload;

  console.log(`Detectando infracciones para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'detectando_infracciones';

  compra.hasPublicacion = Math.random() > 0.7 ? true : false;

  compra.historial_estados.push('infraccion_detectada');

  console.log(`Resultado infracción compra ${compra.id}: ${compra.hasPublicacion}`);

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
        evento: 'infraccion_detectada',
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

app.post('/infracciones', (req, res) => {

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
  console.log(`Servidor Infracciones escuchando en puerto ${PORT}`);
});