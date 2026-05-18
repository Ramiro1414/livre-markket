process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();
const jwt = require('jsonwebtoken');

const EventEmitter = require('events');
const bus = new EventEmitter();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/compras.key'),
  cert: fs.readFileSync('./certs/compras.crt')
};

const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_NAME = 'compras';

// "Base de datos" en memoria
const compras = {};
let currentId = 1;

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/compras', (req, res) => {

  const authHeader = req.headers.authorization;
  
  // token inexistente
  if (!authHeader) { 

    return res.status(401).json({
      error: 'Token no enviado'
    });

  }

  // formato bearer
  const token = authHeader.split(' ')[1];

  if (!token) {

    return res.status(401).json({
      error: 'Token inválido'
    });

  }

  try {

    // verifico token
    const decoded = jwt.verify(token, JWT_SECRET);

    console.log(`Token válido emitido por: ${decoded.iss}`);

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

  } catch (error) {

    // token expirado
    if (error.name === 'TokenExpiredError') {

      return res.status(401).json({
        error: 'Token expirado'
      });

    }

    // token invalido
    return res.status(401).json({
      error: 'Token inválido'
    });

  }
});

bus.on('producto_enviado', async (payload) => {

  let { compra } = payload;

  console.log(`Finalizando compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'compra_confirmada_en_proceso_de_envio';

  compra.historial_estados.push(
    'compra_confirmada_en_proceso_de_envio'
  );

  // ==========================================
  // guardar localmente
  // ==========================================

  compras[compra.id] = compra;

  console.log(`Compra ${compra.id} almacenada localmente`);

  console.log(`Compra ${compra.id} finalizada`);

  console.log('===============================================');

  console.log(JSON.stringify(compra, null, 2));

  // ==========================================
  // emitir evento final
  // ==========================================

  const eventoFinal = {
    evento: 'compra_confirmada_en_proceso_de_envio',
    compra
  };

  const token = generarToken(SERVICE_NAME);

  fetch('https://web:3000/web', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

    console.log(`Error comunicando con Web`);
  });

  fetch('https://publicaciones:3000/publicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

    console.log(`Error comunicando con Publicaciones`);
  });
  
});

bus.on('pago_rechazado', async (payload) => {

  let { compra } = payload;

  console.log(`Pago rechazado para compra ${compra.id}`);

  console.log(`Cancelando pedido para compra ${compra.id}`);

  cancelar_compra(compra)
});

bus.on('reserva_producto_cancelada', async (payload) => {

  let { compra } = payload;

  console.log(`Finalizando cancelación de compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'compra_cancelada';

  compra.historial_estados.push('compra_cancelada');

  compras[compra.id] = compra

  console.log(`Compra ${compra.id} cancelada`);

  console.log('===============================================');

  console.log(JSON.stringify(compra, null, 2));

  // ==========================================
  // emitir evento final
  // ==========================================

  const eventoFinal = {
    evento: 'compra_cancelada',
    compra
  };

  const token = generarToken(SERVICE_NAME);

  fetch('https://web:3000/web', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

      console.log(`Error comunicando con Web`);
  });

  fetch('https://publicaciones:3000/publicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(eventoFinal)
  }).catch(error => {

    console.log(`Error comunicando con Publicaciones`);
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

  const token = generarToken(SERVICE_NAME);

  // Emitir evento a Publicaciones
  await fetch('https://publicaciones:3000/publicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
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

  console.log(`Evento forma_pago_seleccionada recibido`);

  if (fanInCompleto(compra)) {

    console.log(`Fan-in alcanzado para compra ${compra.id}`);

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

  console.log(`Evento infraccion_detectada recibido`);

  if (fanInCompleto(compra)) {

    console.log(`Fan-in alcanzado para compra ${compra.id}`);

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
  console.log(`Confirmando compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'compra_confirmada';

  compra.historial_estados.push('compra_confirmada');

  console.log(`Compra ${compra.id} confirmada`);

  // ==========================================
  // evento hacia Pagos
  // ==========================================

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://pagos:3000/pagos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

  console.log(`Cancelando pedido para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'pedido_cancelado';

  compra.historial_estados.push('pedido_cancelado');

  console.log(`Pedido cancelado para compra ${compra.id}`);

  // ==========================================
  // evento hacia Publicaciones
  // ==========================================

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://publicaciones:3000/publicaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

function generarToken(servicio) {
  return jwt.sign(
    { iss: servicio },
    JWT_SECRET,
    { expiresIn: '60s' },
    { algorithm: 'HS256' }
  );
}

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de compras HTTPS escuchando en puerto ${PORT}`);
  console.log(`JWT_SECRET: ${JWT_SECRET}`);
});