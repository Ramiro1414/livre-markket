const express = require('express');
const EventEmitter = require('events');

const { consumirEventos } = require('./rabbitmq');

const app = express();
const bus = new EventEmitter();

app.use(express.json());

const PORT = 3000;

const compras = {};

consumirEventos('cqrs', (payload) => {

  const { evento } = payload;

  if (bus.listenerCount(evento) === 0) {

    console.log(`Evento no soportado: ${evento}`);

    return;

  }

  console.log(`Command de escritura recibido: ${evento}`);

  bus.emit(evento, payload);

});

// compra iniciada y en proceso
bus.on('nuevo_pedido_creado', (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

// compra finalizada exitosamente
bus.on('compra_confirmada_en_proceso_de_envio', (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

// compra cancelada
bus.on('compra_cancelada', (payload) => {

  const { compra } = payload;

  compras[compra.id] = compra;

});

app.get('/cqrs/estadisticas/exitosas', (req, res) => {

  const cantidad = Object.values(compras)
    .filter(compra =>
      compra.estado === 'compra_confirmada_en_proceso_de_envio'
    )
    .length;

  return res.status(200).json({
    cantidad
  });

});

app.get('/cqrs/estadisticas/canceladas', (req, res) => {

  const cantidad = Object.values(compras)
    .filter(compra =>
      compra.estado === 'compra_cancelada'
    )
    .length;

  return res.status(200).json({
    cantidad
  });

});

app.get('/cqrs/estadisticas/en-proceso', (req, res) => {

  const cantidad = Object.values(compras)
    .filter(compra =>
      compra.estado !== 'compra_cancelada' &&
      compra.estado !== 'compra_confirmada_en_proceso_de_envio'
    )
    .length;

  return res.status(200).json({
    cantidad
  });

});

app.get('/cqrs/estadisticas/canceladas-por-motivo', (req, res) => {

  let infracciones = 0;
  let pagosRechazados = 0;
  let otros = 0;

  Object.values(compras).forEach(compra => {

    if (compra.estado !== 'compra_cancelada') {
      return;
    }

    if (compra.hasPublicacion === true) {

      infracciones++;

    } else if (compra.estado_pago === 'rechazado') {

      pagosRechazados++;

    } else {

      otros++;

    }

  });

  return res.status(200).json({
    infracciones,
    pagosRechazados,
    otros
  });

});

app.get('/cqrs/compras', (req, res) => {

  return res.status(200).json(
    Object.values(compras)
  );

});

app.get('/cqrs/compras/:id', (req, res) => {

  const compra = compras[req.params.id];

  if (!compra) {

    return res.status(404).json({
      error: 'Compra no encontrada'
    });

  }

  return res.status(200).json(compra);

});

app.listen(PORT, () => {

  console.log(`CQRS escuchando en puerto ${PORT}`);

});