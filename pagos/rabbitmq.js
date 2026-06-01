const amqp = require('amqplib');

const RABBIT_URL = 'amqp://arys:arys@rabbitmq:5672';
const EXCHANGE = 'livre_market';

let connection = null;
let channel = null;

async function conectarRabbit() {

  if (channel) {
    return channel;
  }

  connection = await amqp.connect(RABBIT_URL);

  channel = await connection.createChannel();

  await channel.assertExchange(
    EXCHANGE,
    'topic',
    { durable: true }
  );

  console.log('Conectado a RabbitMQ');

  return channel;
}

async function publicarEvento(destino, payload) {

  const channel = await conectarRabbit();

  const routingKey = `evento.${destino}`;

  channel.publish(
    EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true
    }
  );

  console.log(
    `Evento enviado a ${destino}`
  );
}

async function consumirEventos(nombreCola, callback) {

  const channel = await conectarRabbit();

  await channel.assertQueue(
    nombreCola,
    { durable: true }
  );

  console.log(`Escuchando cola ${nombreCola}`);

  channel.consume(nombreCola, (msg) => {

    if (!msg) {
      return;
    }

    const payload = JSON.parse(
      msg.content.toString()
    );

    callback(payload);

    channel.ack(msg);

  });
}

module.exports = {
  conectarRabbit,
  publicarEvento,
  consumirEventos
};