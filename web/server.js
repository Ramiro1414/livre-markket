process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

const app = express();

app.use(express.json());

const options = {
  key: fs.readFileSync('./certs/web.key'),
  cert: fs.readFileSync('./certs/web.crt')
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
const nombre = 'web'
const password = '333333333'

const bus = new EventEmitter();

const compras = {};

// ==================================================
// Helpers
// ==================================================

function randomFormaEntrega() {

  const opciones = ['correo', 'retira'];

  return opciones[Math.floor(Math.random() * opciones.length)];
}

bus.on('compra_cancelada', async (payload) => {

  const { compra } = payload;

  console.log(`Guardando compra ${compra.id} en Web`);

  // ==========================================
  // guardar localmente cuando se cancela la compra
  // ==========================================

  compras[compra.id] = compra;

  console.log(`Compra ${compra.id} almacenada en Web`);
});

bus.on('compra_confirmada_en_proceso_de_envio', async (payload) => {

  const { compra } = payload;

  console.log(`Guardando compra ${compra.id} en Web`);

  // ==========================================
  // guardar localmente cuando se confirma y envia la compra
  // ==========================================

  compras[compra.id] = compra;

  console.log(`Compra ${compra.id} almacenada en Web`);
});

// ==================================================
// Listener: forma_entrega_solicitada
// ==================================================

bus.on('forma_entrega_solicitada', async (payload) => {

  const { compra } = payload;

  console.log(`Seleccionando forma de entrega para compra ${compra.id}`);

  compra.forma_entrega = randomFormaEntrega();

  console.log(`Forma seleccionada: ${compra.forma_entrega}`);

  try {

    await fetch('https://envios:3000/envios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_entrega_seleccionada',
        compra,
        nombre: nombre,
        password: password
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Envios`);
  }
});

// ==================================================
// Listener: forma_pago_solicitada
// ==================================================

bus.on('forma_pago_solicitada', async (payload) => {

  const { compra } = payload;

  console.log(`Seleccionando forma de pago para compra ${compra.id}`);

  compra.medio_pago =
    Math.random() > 0.5 ? 'tarjeta' : 'efectivo';

  console.log(`Medio de pago seleccionado: ${compra.medio_pago}`);

  try {

    await fetch('https://pagos:3000/pagos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'forma_pago_seleccionada',
        compra,
        nombre: nombre,
        password: password
      })
    });

  } catch (error) {

    console.log(`Error comunicando con Pagos`);
  }
});

// ==================================================
// Endpoint único
// ==================================================

app.post('/web', (req, res) => {

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
// Endpoint inicial del workflow
// ==================================================

app.post('/simular-compra', async (req, res) => {

  const { producto } = req.body;

  console.log(`Cliente seleccionó producto: ${producto}`);

  try {

    await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'producto_seleccionado',
        producto,
        nombre: nombre, // !!!!!!!!!!!!! TESTEANDO CREDENCIALES !!!!!!!!!!!!! 
        password: password // !!!!!!!!!!!!! TESTEANDO CREDENCIALES !!!!!!!!!!!!! 
      })
    });

    return res.status(200).json({
      mensaje: 'Compra iniciada'
    });

  } catch (error) {

    return res.status(500).json({
      error: 'Error comunicando con Compras'
    });
  }
});

// ==================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================================================

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor web HTTPS escuchando en puerto ${PORT}`);
});