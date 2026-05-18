#!/usr/bin/env node

const jwt = require('jsonwebtoken');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const WEB_URL = 'https://web:3000';
const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_NAME = 'simulador_compras';

comprar('producto1');
comprar('producto2');
comprar('producto3');
comprar('producto4');
comprar('producto5');

async function comprar(producto) {

  try {

    const token = generarToken("SERVICE_NAME");

    console.log('====================================================');
    console.log(`Iniciando compra de ${producto}`);
    console.log('====================================================');

    const response = await fetch(`${WEB_URL}/simular-compra`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        producto
      })
    });

    const data = await response.json();

    console.log('*************************************************************************');
    console.log(`*** SIMULACIÓN FINALIZADA ${producto} Time: ${new Date().toISOString()} ***`);
    console.log('*************************************************************************');

    console.log(JSON.stringify(data, null, 3));
    console.log('\n\n');

  } catch (error) {

    console.error(`Error simulando compra de ${producto}`);

    console.error(error);
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