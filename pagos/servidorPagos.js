process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/pagos.key'),
  cert: fs.readFileSync('./certs/pagos.crt')
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
const SERVICE_NAME = 'pagos';

const bus = new EventEmitter();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/pagos', (req, res) => {

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

bus.on('compra_confirmada', async (payload) => {

  let { compra } = payload;

  compra.estado = 'autorizando_pago';

  compra.historial_estados.push('autorizando_pago');

  compra.estado_pago =
    Math.random() > 0.7 ? 'rechazado' : 'aprobado';

  if (compra.estado_pago === 'rechazado') {

    const token = generarToken(SERVICE_NAME);

    try {

      await fetch('https://compras:3000/compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://envios:3000/envios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

bus.on('producto_reservado', async (payload) => {

  const { compra } = payload;

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://web:3000/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

bus.on('forma_pago_seleccionada', async (payload) => {

  let { compra } = payload;

  compra.estado = 'forma_pago_seleccionada';

  compra.historial_estados.push('forma_pago_seleccionada');

  const token = generarToken(SERVICE_NAME);

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
  console.log(`Servidor de pagos HTTPS escuchando en puerto ${PORT}`);
});