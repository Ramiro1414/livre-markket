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

bus.on('envio_calculado', async (payload) => {

  let compra = mergearCompra(payload.compra);

  console.log(`Evento envio_calculado recibido`);

  if (fanInCompleto(compra)) {

    console.log(`Fan-in alcanzado para compra ${compra.id}`);

    await fetch('http://infracciones:3000/infracciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'verificar_infraccion',
        compra
      })
    });
  }
});

bus.on('forma_pago_seleccionada', async (payload) => {

  let compra = mergearCompra(payload.compra);

  console.log(`Evento forma_pago_seleccionada recibido`);

  if (fanInCompleto(compra)) {

    console.log(`Fan-in alcanzado para compra ${compra.id}`);

    console.log('La compra es:');
    console.log(JSON.stringify(compra, null, 2));

    console.log('===================================================');

    await fetch('http://infracciones:3000/infracciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'verificar_infraccion',
        compra
      })
    });
  }
});

bus.on('infraccion_detectada', async (payload) => {

  let compra = mergearCompra(payload.compra);

  console.log(`Evento infraccion_detectada recibido`);

  if (fanInCompleto(compra)) {

    console.log(`Fan-in alcanzado para compra ${compra.id}`);

    await fetch('http://infracciones:3000/infracciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'verificar_infraccion',
        compra
      })
    });
  }
});


// ======= funciones helpers de merge y verificar sincronizacion =======
function mergearCompra(compraActualizada) {

  const compraExistente = compras[compraActualizada.id];

  compras[compraActualizada.id] = {
    ...compraExistente,
    ...compraActualizada,

    historial_estados: [
      ...new Set([
        ...(compraExistente.historial_estados || []),
        ...(compraActualizada.historial_estados || [])
      ])
    ]
  };

  return compras[compraActualizada.id];
}

function fanInCompleto(compra) {

  const historial = compra.historial_estados;

  return (
    historial.includes('envio_calculado') &&
    historial.includes('forma_pago_seleccionada') &&
    historial.includes('infraccion_detectada')
  );
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de compras escuchando en puerto ${PORT}`);
});