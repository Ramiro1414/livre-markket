const express = require('express');
const app = express();

app.use(express.json());

// "Base de datos" en memoria
const infracciones = {};

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


app.post('/infracciones/detectar', (req, res) => {
  const { compra } = req.body;

  // Validación
  if (!compra) {
    return res.status(400).json({
      error: 'Compra es obligatoria'
    });
  }

  // Lógica de negocio
  compra.estado = 'detectando_infracciones';
  compra.hasPublicacion = Math.random() > 0.7 ? true : false;

  console.log(`Detectando infraccion para compra ${compra.id}. ¿Hay infraccion?: ${compra.hasPublicacion}`);

  // Respuesta
  return res.json(compra);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de infracciones escuchando en puerto ${PORT}`);
});