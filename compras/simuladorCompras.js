#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const WEB_URL = 'https://web:3000';

comprar('producto1');
comprar('producto2');
comprar('producto3');
comprar('producto4');
comprar('producto5');

async function comprar(producto) {

  try {

    console.log('====================================================');
    console.log(`Iniciando compra de ${producto}`);
    console.log('====================================================');

    const response = await fetch(`${WEB_URL}/simular-compra`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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