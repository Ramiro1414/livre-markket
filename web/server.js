const express = require('express');

const app = express();
app.use(express.json());

const COMPRAS_URL = 'http://compras:3000';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'web ok' });
});

// Simulación de compra completa
app.post('/simular-compra', async (req, res) => {
  const { producto, forma_entrega, medio_pago } = req.body;

  try {
    // ---------------------------
    // 1. Crear compra
    // ---------------------------
    let response = await fetch(`${COMPRAS_URL}/compras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto })
    });

    let data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        paso: 'crear_compra',
        detalle: data
      });
    }

    const compraId = data.id;

    // ---------------------------
    // 2. Seleccionar envío
    // ---------------------------
    response = await fetch(`${COMPRAS_URL}/compras/${compraId}/envio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forma_entrega })
    });

    data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        paso: 'envio',
        compraId,
        detalle: data
      });
    }

    // ---------------------------
    // 3. Seleccionar pago
    // ---------------------------
    response = await fetch(`${COMPRAS_URL}/compras/${compraId}/pago`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medio_pago })
    });

    data = await response.json();

    return res.status(response.status).json({
      paso: 'final',
      compraId,
      resultado: data
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Error en la comunicación con el servidor de compras'
    });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en puerto ${PORT}`);
});