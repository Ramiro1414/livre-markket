#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


// credenciales validas
const nombre = 'web';
const password = '333333333';

async function realizarPrueba(nombrePrueba, body) {

  console.log('\n===================================================');
  console.log(`PRUEBA: ${nombrePrueba}`);
  console.log('===================================================\n');

  try {

    const response = await fetch('https://compras:3000/compras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log(`STATUS: ${response.status}`);
    console.log(data);

  } catch (error) {

    console.log(`Error ejecutando prueba`);
    console.log(error);

  }
}


// pruebas
async function main() {

  // sin credenciales
  await realizarPrueba(

    'llamada_sin_credenciales',

    {
      evento: 'producto_seleccionado',
      producto: 'producto1'
    }
  );

  // credenciales invalidas
  await realizarPrueba(

    'llamada_con_credenciales_invalidas',

    {
      evento: 'producto_seleccionado',
      producto: 'producto2',
      nombre: 'web',
      password: '000000000'
    }
  );

  // credenciales validas
  await realizarPrueba(

    'llamada_con_credenciales_validas',

    {
      evento: 'producto_seleccionado',
      producto: 'producto3',
      nombre,
      password
    }
  );
}

main();