process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();
const jwt = require('jsonwebtoken');
const path = require('path');
const { publicarEvento, consumirEventos } = require('./rabbitmq');

const EventEmitter = require('events');
const bus = new EventEmitter();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/compras.key'),
  cert: fs.readFileSync('./certs/compras.crt')
};

const PRIVATE_KEY = fs.readFileSync(
  path.join(__dirname, 'keys/private.key'),
  'utf8'
);

const PUBLIC_KEYS = {

  web: fs.readFileSync(
    path.join(__dirname, 'keys/web.public.key'),
    'utf8'
  ),

  pagos: fs.readFileSync(
    path.join(__dirname, 'keys/pagos.public.key'),
    'utf8'
  ),

  envios: fs.readFileSync(
    path.join(__dirname, 'keys/envios.public.key'),
    'utf8'
  ),

  publicaciones: fs.readFileSync(
    path.join(__dirname, 'keys/publicaciones.public.key'),
    'utf8'
  ),

  infracciones: fs.readFileSync(
    path.join(__dirname, 'keys/infracciones.public.key'),
    'utf8'
  ),

  compras: fs.readFileSync(
    path.join(__dirname, 'keys/compras.public.key'),
    'utf8'
  )
};

const SERVICE_NAME = 'compras';

// "Base de datos" en memoria
const compras = {};
let currentId = 1;

consumirEventos('compras', (payload) => {

  const { evento } = payload;

  if (bus.listenerCount(evento) === 0) {

    console.log(`Evento no soportado: ${evento}`);

    return;
  }

  bus.emit(evento, payload);

});

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/compras/listar', (req, res) => {

  return res.status(200).json({
    compras
  });

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

    const decoded = jwt.decode(token);

    const publicKey = PUBLIC_KEYS[decoded.iss];

    // verifico si existe clave publica del emisor
    if (!publicKey) {
      console.log(`Emisor desconocido: ${decoded.iss}`);
      return res.status(401).json({
        error: 'Emisor desconocido'
      });

    }

    // verifico que el token este bien formado
    if (!decoded || !decoded.iss) {
      console.log(`Token malformado`);
      return res.status(401).json({
        error: 'Token malformado'
      });

    }

    jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    });

    const { evento } = req.body;

    if (bus.listenerCount(evento) === 0) {
      return res.status(400).json({
        error: `Evento no soportado: ${evento}`
        });
    }

    res.status(200).json({
      mensaje: 'Evento recibido'
    });

    console.log(`Token valido`);

    bus.emit(evento, req.body);

  } catch (error) {

    // token expirado
    if (error.name === 'TokenExpiredError') {
      console.log(`Token expirado`);
      return res.status(401).json({
        error: 'Token expirado'
      });

    }

    console.log(`Token inválido: ${error.message}`);

    // token invalido
    return res.status(401).json({
      error: 'Token inválido'
    });

  }
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
    compra
  };

  try {

    await publicarEvento('web', eventoFinal);

    await publicarEvento('publicaciones', eventoFinal);

  } catch (error) {

    console.log('Error publicando evento final');

    console.error(error);

  }

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
    compra
  };

  try {

    await publicarEvento('web', eventoFinal);

    await publicarEvento('publicaciones', eventoFinal);

  } catch (error) {

    console.log('Error publicando evento final');

    console.error(error);

  }

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

    await publicarEvento('publicaciones', {
      evento: 'nuevo_pedido_creado',
      compra
    });

  } catch (error) {

    console.error(error);

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

    await publicarEvento('pagos', {
      evento: 'compra_confirmada',
      compra
    });

  } catch (error) {

    console.error(error);

  }

}

async function cancelar_compra(compra) {

  compra.estado = 'pedido_cancelado';

  compra.historial_estados.push('pedido_cancelado');

  try {

    await publicarEvento('publicaciones', {
      evento: 'pedido_cancelado',
      compra
    });

  } catch (error) {

    console.error(error);

  }
  
}

function generarToken(servicio) {

  return jwt.sign(

    {
      iss: servicio
    },

    PRIVATE_KEY,

    {
      algorithm: 'RS256',
      expiresIn: '60s'
    }
  );
}

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de compras HTTPS escuchando en puerto ${PORT}`);
});