#!/usr/bin/env node

async function simularCompras() {

  const compras = [];

  for (let i = 1; i <= 5; i++) {

    compras.push(
      fetch('http://wso2-mi:8290/compras/iniciar-compra', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          producto: `producto ${i}`
        })
      })
      .then(res => res.json())
      .then(data => {
        console.log(
          `Compra ${i} completada:`,
          data
        );
        return data;
      })
      .catch(error => {
        console.error(
          `Error en compra ${i}:`,
          error
        );
      })
    );

  }

  const resultados = await Promise.all(compras);

  return;
}

simularCompras();
