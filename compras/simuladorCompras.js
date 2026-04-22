#!/usr/bin/env node

var CompraWorkflow = require('./comprasImpl');
// simula la llegada de un nuevo mensaje encolado de compra

comprar('producto1');
comprar('producto2');
comprar('producto3');
comprar('producto4');
comprar('producto5');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function comprar(producto) {
  var compra = new CompraWorkflow();
  // simula la selección del producto a comprar desde la web init()
  await compra.iniciarCompra(producto);

  // finaliza simulación
  console.log('*************************************************************************');
  console.log('*** SIMULACIÓN FINALIZADA ',producto,'Time: ',new Date().toISOString(), ' ***');
  console.log('*************************************************************************');
  console.log(JSON.stringify(compra.compra,null,3));
  console.log('\n\n');
}
