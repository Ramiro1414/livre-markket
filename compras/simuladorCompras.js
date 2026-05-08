#!/usr/bin/env node

const WEB_URL = 'http://web:3000';

const formasEntrega = ['correo', 'retira'];
const mediosPago = ['efectivo', 'tarjeta'];

// Simulación concurrente
comprar('producto1');
comprar('producto2');
comprar('producto3');
comprar('producto4');
comprar('producto5');

// ==================================================

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// ==================================================

async function comprar(producto) {

  const forma_entrega = randomItem(formasEntrega);
  const medio_pago = randomItem(mediosPago);

  try {

    console.log('====================================================');
    console.log(`Iniciando compra de ${producto}`);
    console.log(`Forma entrega: ${forma_entrega}`);
    console.log(`Medio pago: ${medio_pago}`);
    console.log('====================================================');

    const response = await fetch(`${WEB_URL}/simular-compra`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        producto,
        forma_entrega,
        medio_pago
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