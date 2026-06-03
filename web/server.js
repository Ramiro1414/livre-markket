process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');
const jwt = require('jsonwebtoken');
const path = require('path');
const { publicarEvento, consumirEventos } = require('./rabbitmq');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/web.key'),
  cert: fs.readFileSync('./certs/web.crt')
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
const SERVICE_NAME = 'web';

const bus = new EventEmitter();

const compras = {};

consumirEventos('web', (payload) => {

  const { evento } = payload;

  if (bus.listenerCount(evento) === 0) {

    console.log(`Evento no soportado: ${evento}`);

    return;
  }

  bus.emit(evento, payload);

});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/web/listar', (req, res) => {

  return res.status(200).json({
    compras
  });

});

app.post('/simular-compra', async (req, res) => {

  const { producto } = req.body;

  try {

    await publicarEvento('compras', {
      evento: 'producto_seleccionado',
      producto
    });

    return res.status(200).json({
      mensaje: 'Compra iniciada'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: 'Error publicando evento'
    });
  }
});

function randomFormaEntrega() {

  const opciones = ['correo', 'retira'];

  return opciones[Math.floor(Math.random() * opciones.length)];
}

bus.on('compra_cancelada', async (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

bus.on('compra_confirmada_en_proceso_de_envio', async (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

bus.on('forma_entrega_solicitada', async (payload) => {

  const { compra } = payload;

  compra.forma_entrega = randomFormaEntrega();

  try {

    await publicarEvento('envios', {
      evento: 'forma_entrega_seleccionada',
      compra
    });

  } catch (error) {

    console.error(error);

  }
});

bus.on('forma_pago_solicitada', async (payload) => {

  const { compra } = payload;

  compra.medio_pago =
    Math.random() > 0.5 ? 'tarjeta' : 'efectivo';

  try {

    await publicarEvento('pagos', {
      evento: 'forma_pago_seleccionada',
      compra
    });

  } catch (error) {

    console.error(error);

  }

});

app.post('/web', (req, res) => {

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
  console.log(`Servidor web HTTPS escuchando en puerto ${PORT}`);
});