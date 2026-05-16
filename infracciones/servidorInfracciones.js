process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/infracciones.key'),
  cert: fs.readFileSync('./certs/infracciones.crt')
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
const nombre = 'infracciones'
const password = '222222222'

const bus = new EventEmitter();

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

  compra.historial_estados.push('detectando_infracciones')

  compra.hasPublicacion = Math.random() > 0.7 ? true : false;

  compra.estado = 'infraccion_detectada';

  compra.historial_estados.push('infraccion_detectada');

  console.log(`Resultado infracción compra ${compra.id}: ${compra.hasPublicacion}`);

  // ==========================================
  // evento hacia Compras
  // ==========================================

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'infraccion_detectada',
        compra,
        nombre: nombre,
        password: password
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

  const { evento, nombre, password } = req.body;

  console.log(`Evento recibido: ${evento}`);

  // ==========================================
  // credenciales ausentes
  // ==========================================

  if (!nombre || !password) {

    return res.status(400).json({
      error: 'Credenciales requeridas'
    });

  }

  // ==========================================
  // servicio inexistente
  // ==========================================

  if (!SERVICIOS_AUTORIZADOS[nombre]) {

    return res.status(401).json({
      error: 'Servicio no autorizado'
    });

  }

  // ==========================================
  // password inválida
  // ==========================================

  if (SERVICIOS_AUTORIZADOS[nombre] !== password) {

    return res.status(401).json({
      error: 'Credenciales inválidas'
    });

  }

  if (bus.listenerCount(evento) === 0) {

    return res.status(400).json({
      error: `Evento no soportado: ${evento}`
    });
  }

  // responder primero
  res.status(200).json({
    mensaje: 'Evento recibido'
  });

  bus.emit(evento, req.body);
});

// ==================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================================================

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor de infracciones HTTPS escuchando en puerto ${PORT}`);
});