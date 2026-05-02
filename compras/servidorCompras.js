const express = require('express');
const app = express();

const ComprasService = require('./servicios/compras');

app.use(express.json());

const comprasService = new ComprasService();

// "Base de datos" en memoria
const compras = {};
let currentId = 1;

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================================================
//            Seleccionar producto
// ==================================================
app.post('/compras', async (req, res) => {
  const { producto } = req.body;

  console.log(`Cliente selecciono producto: ${producto}`);

  // Validación básica
  if (!producto) {
    return res.status(400).json({
      error: 'El campo "producto" es obligatorio'
    });
  }

  // Crear nueva compra/nuevo pedido
  console.log(`Nuevo pedido para compra con id: ${currentId}`);
  let nuevaCompra = comprasService.seleccionarProducto(producto, currentId++)
  console.log(`Reservando producto: ${producto} para compra: ${currentId-1}`);
  let response = await fetch('http://publicaciones:3000/publicaciones/productos/reservar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevaCompra)
  });

  nuevaCompra = await response.json();

  // Guardar en memoria
  compras[nuevaCompra.id] = nuevaCompra;

  // Respuesta
  console.log(`Solicitando forma de entrega para compra: ${currentId-1}`);
  res.status(201).json(nuevaCompra);
});


// ==================================================
//            Seleccionar forma de entrega
// ==================================================
app.put('/compras/:id/envio', async (req, res) => {
  const { id } = req.params;
  const { forma_entrega } = req.body;

  // Validar existencia
  let compra = compras[id];
  if (!compra) {
    return res.status(404).json({
      error: 'Compra no encontrada'
    });
  }

  // Validar input
  if (!forma_entrega) {
    return res.status(400).json({
      error: 'El campo "forma_envio" es obligatorio'
    });
  }

  if (!['correo', 'retira'].includes(forma_entrega)) {
    return res.status(400).json({
      error: 'Forma de envío inválida'
    });
  }

  console.log(`Forma de entrega seleccionada: ${forma_entrega}`);

  let response = await fetch('http://envios:3000/envios/calcular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compra,
      forma_entrega
    })
  });

  let compraActualizada = await response.json();

  // Guardar cambios
  compras[id] = compraActualizada;

  // Respuesta
  console.log(`Solicitando medio de pago para compra: ${currentId-1}`);
  res.status(200).json(compraActualizada);
});

// ==================================================
//            Seleccionar medio de pago
// ==================================================
app.put('/compras/:id/pago', async (req, res) => {
  const { id } = req.params;
  const { medio_pago } = req.body;

  // Validar existencia
  let compra = compras[id];
  if (!compra) {
    return res.status(404).json({
      error: 'Compra no encontrada'
    });
  }

  // Validar input
  if (!medio_pago) {
    return res.status(400).json({
      error: 'El campo "forma_pago" es obligatorio'
    });
  }

  if (!['efectivo', 'tarjeta'].includes(medio_pago)) {
    return res.status(400).json({
      error: 'Forma de pago inválida'
    });
  }

  console.log(`Medio de pago seleccionado: ${medio_pago}`);

  let response = await fetch('http://pagos:3000/pagos/medio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compra,
      medio_pago
    })
  });

  let compraActualizada = await response.json();

  // Detectar infracicones
  console.log(`Detectando infracciones para compra con id: ${currentId-1}`);
  response = await fetch('http://infracciones:3000/infracciones/detectar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compra: compraActualizada
    })
  });

compraActualizada = await response.json();

  if (compraActualizada.hasPublicacion) {
    console.log(`Existe infraccion, cancelando pedido para compra con id: ${currentId-1}`);
    compraActualizada = comprasService.cancelarPedido(compraActualizada)
    console.log(`Cancelando reserva de producto`);
    compraActualizada = comprasService.cancelarReservaProducto(compraActualizada)
    console.log(`Compra con id: ${currentId-1} fue cancelada por infraccion`);
    console.log(`===============================================`);
    compras[id] = compraActualizada;
    return res.status(200).json(compraActualizada);
  }

  console.log(`Compra con id ${currentId-1} confirmada`);
  compraActualizada = comprasService.confirmarCompra(compraActualizada)
  
  // Autorizar pago
  console.log(`Autorizando pago para compra con id: ${currentId-1}`);
  response = await fetch('http://pagos:3000/pagos/autorizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compra: compraActualizada
    })
  });

  compraActualizada = await response.json();
  
  if (compraActualizada.resultado_pago === 'rechazado') {
    console.log(`Pago rechazado, cancelando pedido para compra con id: ${currentId-1}`);
    compraActualizada = comprasService.cancelarPedido(compraActualizada)
    console.log(`Cancelando reserva de producto`);
    compraActualizada = comprasService.cancelarReservaProducto(compraActualizada)
    console.log(`Compra con id: ${currentId-1} fue cancelada por pago rechazado`);
    console.log(`===============================================`);
    compras[id] = compraActualizada;
    return res.status(200).json(compraActualizada);
  }

  // Enviar producto
  console.log(`Enviando producto para compra con id: ${currentId-1}`);
  response = await fetch('http://envios:3000/envios/enviar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compra: compraActualizada
    })
  });

  compraActualizada = await response.json();

  // Finalizar compra
  console.log(`Compra con id: ${currentId-1} confirmada, en proceso de envio y finalizada.`);
  compraActualizada = comprasService.finalizarCompra(compraActualizada)
  console.log(`===============================================`);

  // Guardar cambios
  compras[id] = compraActualizada;

  // Respuesta
  res.status(200).json(compraActualizada);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de compras escuchando en puerto ${PORT}`);
});