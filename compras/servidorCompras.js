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

const SERVICIOS_AUTORIZADOS = {
  compras: '123456789',
  pagos: '987654321',
  envios: '555555555',
  publicaciones: '111111111',
  infracciones: '222222222',
  web: '333333333'
};

// credenciales
const nombre = 'compras'
const password = '123456789'

const compras = {};
let currentId = 1;

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/compras', (req, res) => {

  const { evento, nombre, password } = req.body;

  // sin credenciales
  if (!nombre || !password) {
    console.log(`Credenciales faltantes en la solicitud`);
    return res.status(401).json({
      error: 'Credenciales requeridas'
    });

  }

  // servicio que no existe
  if (!SERVICIOS_AUTORIZADOS[nombre]) {

    console.log(`Servicio no autorizado: ${nombre}`);
    return res.status(401).json({
      error: 'Servicio no autorizado'
    });

  }

  // contraseña invalida
  if (SERVICIOS_AUTORIZADOS[nombre] !== password) {

    console.log(`Credenciales inválidas para el servicio: ${nombre}`);
    return res.status(401).json({
      error: 'Credenciales inválidas'
    });

  }

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  console.log(`Credenciales validas para el servicio: ${nombre}. Procesando evento: ${evento}`);

  bus.emit(evento, req.body);
});

bus.on('producto_enviado', async (payload) => {

  let { compra } = payload;

  compra.estado = 'compra_confirmada_en_proceso_de_envio';

  compra.historial_estados.push(
    'compra_confirmada_en_proceso_de_envio'
  );

  compras[compra.id] = compra;

  const eventoFinal = {
    evento: 'compra_confirmada_en_proceso_de_envio',
    compra,
    nombre: nombre,
    password: password
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

  compra.estado = 'compra_cancelada';

  compra.historial_estados.push('compra_cancelada');

  compras[compra.id] = compra

  const eventoFinal = {
    evento: 'compra_cancelada',
    compra,
    nombre: nombre,
    password: password
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

  try {

  // Emitir evento a Publicaciones
  await fetch('https://publicaciones:3000/publicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      evento: 'nuevo_pedido_creado',
      compra,
      nombre: nombre,
      password: password
    })
  });

  } catch (error) {

    console.log(`Error comunicando con Publicaciones`);

  }

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
        compra,
        nombre: nombre,
        password: password
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
        compra,
        nombre: nombre,
        password: password
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Publicaciones`);
  }
  
}

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de compras HTTPS escuchando en puerto ${PORT}`);
});