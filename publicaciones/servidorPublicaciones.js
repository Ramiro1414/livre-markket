process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/publicaciones.key'),
  cert: fs.readFileSync('./certs/publicaciones.crt')
};

const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_NAME = 'publicaciones';

// =========================================
// Event Bus interno
// =========================================

const bus = new EventEmitter();

const compras = {};

bus.on('compra_cancelada', async (payload) => {

  const { compra } = payload;

  console.log(`Guardando compra ${compra.id} en Publicaciones`);

  // ==========================================
  // guardar localmente cuando se cancela la compra
  // ==========================================

  compras[compra.id] = compra;

  console.log(`Compra ${compra.id} almacenada en Publicaciones`);
});

bus.on('compra_confirmada_en_proceso_de_envio', async (payload) => {

  const { compra } = payload;

  console.log(`Guardando compra ${compra.id} en Publicaciones`);

  // ==========================================
  // guardar localmente cuando la compra se confirmo y se envio
  // ==========================================

  compras[compra.id] = compra;

  console.log(`Compra ${compra.id} almacenada en Publicaciones`);
});

// =========================================
// Listener: pedido_cancelado
// =========================================
bus.on('pedido_cancelado', async (payload) => {

  let { compra } = payload;

  console.log(`Cancelando reserva de producto para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'reserva_producto_cancelada';

  compra.historial_estados.push('reserva_producto_cancelada');

  console.log(`Reserva cancelada para compra ${compra.id}`);

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
        evento: 'reserva_producto_cancelada',
        compra
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Compras`);
  }
});

// =========================================
// Listener: nuevo_pedido_creado
// =========================================

bus.on('nuevo_pedido_creado', (payload) => {

  const { compra } = payload;

  console.log(`Reservando producto para compra ${compra.id}`);

  // ==========================================
  // lógica de negocio
  // ==========================================

  compra.estado = 'producto_reservado';

  compra.historial_estados.push('producto_reservado');

  console.log(`Producto reservado para compra ${compra.id}`);

  // ==========================================
  // evento
  // ==========================================

  const evento = {
    evento: 'producto_reservado',
    compra
  };

  const token = generarToken(SERVICE_NAME);

  // ==========================================
  // fan-out asincrónico
  // ==========================================

  fetch('https://envios:3000/envios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Envios`);
  });

  fetch('https://pagos:3000/pagos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Pagos`);
  });

  fetch('https://infracciones:3000/infracciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(evento)
  }).catch(error => {
    console.log(`Error comunicando con Infracciones`);
  });

  console.log(`Eventos emitidos para compra ${compra.id}`);
});

// =========================================
// Endpoint único
// =========================================

app.post('/publicaciones', async (req, res) => {

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

// =========================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// =========================================

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
  console.log(`Servidor de publicaciones HTTPS escuchando en puerto ${PORT}`);
});