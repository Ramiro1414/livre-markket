const express = require('express');
const app = express();

app.use(express.json());

// "Base de datos" en memoria
const envios = {};

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Forma de entrega seleccionada y calcular envio
app.post('/envios/calcular', (req, res) => {
  const { compra, forma_entrega } = req.body;

    console.log(`Compra ${compra.id} selecciono como forma de entrega: ${forma_entrega}`);

  // Validaciones
  if (!compra || !forma_entrega) {
    return res.status(400).json({
      error: 'Compra y forma_entrega son obligatorios'
    });
  }

  // ---------------------------
  // seleccionarFormaEntrega
  // ---------------------------
  compra.forma_entrega = forma_entrega;
  compra.estado = 'forma_entrega_seleccionada';

  // ---------------------------
  // calcularCostoEnvio
  // ---------------------------
  
  if (forma_entrega === 'correo') {
    compra.costo = Math.random() * 1000;
  } else {
    compra.costo = 0;
  }
    
  compra.estado = 'envio_calculado';
  console.log(`Compra ${compra.id} tiene un costo de envio de: $ ${compra.costo}`);

  // Respuesta
  return res.json(compra);
});

app.post('/envios/enviar', (req, res) => {
  const { compra } = req.body;

  console.log(`Enviando compra ${compra.id}`);

  // Validación
  if (!compra) {
    return res.status(400).json({
      error: 'Compra es obligatoria'
    });
  }

  // Lógica de negocio
  compra.estado = 'enviado';

  // Respuesta
  return res.json(compra);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de envios escuchando en puerto ${PORT}`);
});