process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();

const EventEmitter = require('events');
const bus = new EventEmitter();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/compras.key'),
  cert: fs.readFileSync('./certs/compras.crt')
};

// "Base de datos" en memoria
const compras = {};
let currentId = 1;

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/compras', (req, res) => {

  const { evento } = req.body;

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  bus.emit(evento, req.body);
});

bus.on('producto_enviado', async (payload) => {

  let { compra } = payload;

  const estadoValido =
    compra.estado === 'enviando_producto';

  const historialValido =
    compra.historial_estados.includes(
      'enviando_producto'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

  compra.estado = 'compra_confirmada_en_proceso_de_envio';

  compra.historial_estados.push(
    'compra_confirmada_en_proceso_de_envio'
  );

  save(compra)

  // debug
  const compraActual = findById(compra.id);

  console.log(
    'Compra recuperada:',
    JSON.stringify(compraActual, null, 2)
  );

  const eventoFinal = {
    evento: 'compra_confirmada_en_proceso_de_envio',
    compra
  };

  fetch('https://web:3000/web', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

    console.log(`Error comunicando con Web`);
  });

  fetch('https://publicaciones:3000/publicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

    console.log(`Error comunicando con Publicaciones`);
  });
  
});

bus.on('pago_rechazado', async (payload) => {

  let { compra } = payload;

  cancelar_compra(compra)
});

bus.on('reserva_producto_cancelada', async (payload) => {

  let { compra } = payload;

  const estadoValido =
    compra.estado === 'reserva_producto_cancelada';

  const historialValido =
    compra.historial_estados.includes(
      'reserva_producto_cancelada'
    );

  if (!estadoValido || !historialValido) {

    return;
  }

  compra.estado = 'compra_cancelada';

  compra.historial_estados.push('compra_cancelada');

  save(compra)

  // debug
  const compraActual = findById(compra.id);

  console.log(
    'Compra recuperada:',
    JSON.stringify(compraActual, null, 2)
  );

  const eventoFinal = {
    evento: 'compra_cancelada',
    compra
  };

  fetch('https://web:3000/web', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

      console.log(`Error comunicando con Web`);
  });

  fetch('https://publicaciones:3000/publicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

    console.log(`Error comunicando con Publicaciones`);
  });

});

bus.on('producto_seleccionado', async (payload) => {

  const { producto } = payload;

  const compra = {
    id: currentId++,
    producto,
    estado: 'pedido_generado',
    historial_estados: ['pedido_generado']
  };

  save(compra)

  // Emitir evento a Publicaciones
  await fetch('https://publicaciones:3000/publicaciones', {
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

  if (fanInCompleto(compra)) {

    // si hay infraccion
    if (compra.hasPublicacion) {
      cancelar_compra(compra);
    } else {
      continuar_flujo(compra)
    }
    
  }
});

bus.on('forma_pago_seleccionada', async (payload) => {

  let compra = mergearCompra(payload.compra);

  if (fanInCompleto(compra)) {

    // si hay infraccion
    if (compra.hasPublicacion) {
      cancelar_compra(compra);
    } else {
      continuar_flujo(compra)
    }

  }
});

bus.on('infraccion_detectada', async (payload) => {

  let compra = mergearCompra(payload.compra);

  if (fanInCompleto(compra)) {

    // si hay infraccion
    if (compra.hasPublicacion) {
      cancelar_compra(compra);
    } else {
      continuar_flujo(compra)
    }

  }
});


// ======= funciones helpers =======
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

async function continuar_flujo(compra) {

  compra.estado = 'compra_confirmada';

  compra.historial_estados.push('compra_confirmada');

  try {

    await fetch('https://pagos:3000/pagos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'compra_confirmada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Pagos`);
  }

}

async function cancelar_compra(compra) {

  compra.estado = 'pedido_cancelado';

  compra.historial_estados.push('pedido_cancelado');

  try {

    await fetch('https://publicaciones:3000/publicaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'pedido_cancelado',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Publicaciones`);
  }
  
}

function save(compra) {

  compras[compra.id] = {
    ...(compras[compra.id] || {}),
    ...compra
  };

}

function findById(id) {
  return compras[id];
}

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de compras HTTPS escuchando en puerto ${PORT}`);
});