#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const SERVICE_NAME = 'web';

const WEB_PRIVATE_KEY = fs.readFileSync(
  path.join(__dirname, 'keys/private.key'),
  'utf8'
);

// clave privada falsa
const FAKE_PRIVATE_KEY = fs.readFileSync(
  path.join(__dirname, 'keys/private_fake.key'),
  'utf8'
);

const WEB_PUBLIC_KEY = fs.readFileSync(
  path.join(__dirname, 'keys/web.public.key'),
  'utf8'
);

async function enviarCompra(nombrePrueba, token) {

  console.log('\n===================================================');
  console.log(`PRUEBA: ${nombrePrueba}`);
  console.log('===================================================\n');

  try {

    const response = await fetch('https://compras:3000/compras', {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },

      body: JSON.stringify({
        evento: 'producto_seleccionado',
        producto: nombrePrueba
      })
    });

    const body = await response.json();

    console.log(`STATUS: ${response.status}`);
    console.log(body);

  } catch (error) {

    console.log(error);

  }
}

async function main() {


  // token firmado con clave privada desconocida 
  const tokenClaveDesconocida = jwt.sign(

    {
      iss: 'web'
    },

    FAKE_PRIVATE_KEY,

    {
      algorithm: 'RS256',
      expiresIn: '60s'
    }
  );

  await enviarCompra(
    'token_con_clave_privada_desconocida',
    tokenClaveDesconocida
  );


  // token firmado con "iss" cambiado de 'web' a 'envios'.
  const tokenIssuerIncorrecto = jwt.sign(

    {
      iss: 'envios'
    },

    WEB_PRIVATE_KEY,

    {
      algorithm: 'RS256',
      expiresIn: '60s'
    }
  );

  await enviarCompra(
    'token_con_iss_incorrecto',
    tokenIssuerIncorrecto
  );


  // token valido
  const tokenValido = jwt.sign(

    {
      iss: 'web'
    },

    WEB_PRIVATE_KEY,

    {
      algorithm: 'RS256',
      expiresIn: '60s'
    }
  );

  await enviarCompra(
    'token_valido',
    tokenValido
  );

  
  // intento de firmar token con clave publica
  try {

    const tokenConPublicKey = jwt.sign(

      {
        iss: 'web'
      },

      WEB_PUBLIC_KEY,

      {
        algorithm: 'RS256',
        expiresIn: '60s'
      }
    );

    await enviarCompra(
      'token_firmado_con_public_key',
      tokenConPublicKey
    );

  } catch (error) {

    console.log('\n===================================================');
    console.log('PRUEBA: token_firmado_con_public_key');
    console.log('===================================================\n');

    console.log('ERROR ESPERADO:');

    console.log(error.message);

  }
}

main();