process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();
const jwt = require('jsonwebtoken');
const path = require('path');

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/envios.key'),
  cert: fs.readFileSync('./certs/envios.crt')
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


const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_NAME = 'envios';

const bus = new EventEmitter();

bus.on('pago_autorizado', async (payload) => {

  let { compra } = payload;

  console.log(`Enviando producto para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'enviando_producto';

  compra.historial_estados.push('enviando_producto');

  console.log(`Producto enviado para compra ${compra.id}`);

  // ==========================================
  // evento hacia Compras
  // ==========================================

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        evento: 'producto_enviado',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

// ==================================================
// producto_reservado
// ==================================================

bus.on('producto_reservado', async (payload) => {

  const { compra } = payload;

  console.log(`Solicitud de forma de entrega para compra ${compra.id}`);

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://web:3000/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        evento: 'forma_entrega_solicitada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Web`);
  }
});

// ==================================================
// forma_entrega_seleccionada
// ==================================================

bus.on('forma_entrega_seleccionada', async (payload) => {

  let { compra } = payload;

  console.log(`Forma de entrega seleccionada para compra ${compra.id}: ${compra.forma_entrega}`);

  compra.estado = 'forma_entrega_seleccionada';

  compra.historial_estados.push('forma_entrega_seleccionada');

  // ==========================================
  // lógica de negocio
  // ==========================================

  if (compra.forma_entrega === 'correo')
    compra.costo = Math.floor(Math.random() * 1000);
  else
    compra.costo = 0;

  compra.estado = 'envio_calculado';

  compra.historial_estados.push('envio_calculado');

  console.log(`Costo de envío calculado para compra ${compra.id}: ${compra.costo}`);

  // ==========================================
  // evento hacia Compras
  // ==========================================

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        evento: 'envio_calculado',
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

app.post('/envios', (req, res) => {

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

      return res.status(401).json({
        error: 'Emisor desconocido'
      });

    }

    // verifico que el token este bien formado
    if (!decoded || !decoded.iss) {

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

// ==================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================================================

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
  console.log(`Servidor de envios HTTPS escuchando en puerto ${PORT}`);
});