const express = require('express');

const app = express();

app.use(express.json());

const COMPRAS_URL = 'http://compras:3000';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'web ok' });
});

// =========================================
// Seleccionar producto
// =========================================

app.post('/simular-compra', async (req, res) => {

  const { producto } = req.body;

  if (!producto) {
    return res.status(400).json({
      error: 'producto es obligatorio'
    });
  }

  try {

    console.log(`Cliente seleccionó producto: ${producto}`);

    // =========================================
    // Emitir evento a Compras
    // =========================================

    const response = await fetch(`${COMPRAS_URL}/compras`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evento: 'producto_seleccionado',
        producto
      })
    });

    const data = await response.json();

    return res.status(response.status).json(data);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: 'Error comunicando con Compras'
    });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en puerto ${PORT}`);
});