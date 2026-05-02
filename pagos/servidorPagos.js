const express = require('express');
const app = express();

app.use(express.json());

// "Base de datos" en memoria
const pagos = {};

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/pagos/medio', (req, res) => {
  const { compra, medio_pago } = req.body;

  console.log(`Compra ${compra.id} selecciono medio de pago: ${medio_pago}`);

  // Validación básica
  if (!compra || !medio_pago) {
    return res.status(400).json({
      error: 'Compra y medio_pago son obligatorios'
    });
  }

  // Lógica de negocio
  compra.estado = 'medio_pago_seleccionado';
  compra.medio_pago = medio_pago;

  // Respuesta
  return res.json(compra);
});

app.post('/pagos/autorizar', (req, res) => {
  const { compra } = req.body;

  // Validación
  if (!compra) {
    return res.status(400).json({
      error: 'Compra es obligatoria'
    });
  }

  // Lógica de negocio
  compra.estado = 'pagando';
  compra.resultado_pago = Math.random() > 0.3 ? 'autorizado' : 'rechazado';

  console.log(`Autorizando pago... Resultado de pago: ${compra.resultado_pago}`);

  // Respuesta
  return res.json(compra);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de pagos escuchando en puerto ${PORT}`);
});