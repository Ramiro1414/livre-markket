const express = require('express');
const app = express();

app.use(express.json());

// "Base de datos" en memoria
const reservas_productos = {};

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Reservar producto
app.post('/publicaciones/productos/reservar', (req, res) => {
  const compra = req.body;

  // Validación básica
  if (!compra) {
    return res.status(400).json({
      error: 'Compra no enviada'
    });
  }

  // Lógica de negocio
  console.log(`Reservando producto: ${compra.producto}, para la compra: ${compra.id}`);
  compra.estado = 'producto_reservado';

  // Respuesta
  return res.json(compra);
});

// Cancelar reserva de producto
app.post('/publicaciones/productos/cancelar', (req, res) => {

  const compra = req.body;

  // Validación básica
  if (!compra) {
    return res.status(400).json({
      error: 'Compra no enviada'
    });
  }

  // Lógica de negocio
  console.log(`Cancelando reserva de producto: ${compra.producto}, para la compra: ${compra.id}`);

  compra.estado = 'reserva_cancelada';

  // Respuesta
  return res.json(compra);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de publicaciones escuchando en puerto ${PORT}`);
});