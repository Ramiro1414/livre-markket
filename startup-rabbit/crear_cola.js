#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url_localhost;

// recorta los primeros 2 argumentos, "node" y path
var reglas_ruteo = process.argv.slice(2);

if (reglas_ruteo.length == 0) {
  console.log("Usar: crear_cola.js {\"nombre cola\"}");
  process.exit(1);
} else {
  console.log('creando cola: ',reglas_ruteo);
  
}

amqp.connect(amqp_url, function(err, conn) {
  if (err) {
    console.log('error conectando a rabbit: ',err);
    
  } else {
    conn.createChannel(function(err, ch) {

      if (err) {
        console.log('error creando Channel a rabbit: ',err);
      } else {
        var ex = 'livre_market';
  
        // para que las colas no se pierdan con un reinicio {durable: true}
        ch.assertExchange(ex, "topic", {durable: true});
    
        var nombre_cola = reglas_ruteo[0];
        ch.assertQueue(nombre_cola, {durable: true,exclusive: false}, function(err, q) {

          if (err) {
            console.log('Error creando la cola: ', err);
            return;
          }
    
          reglas_ruteo.forEach(function(regla_ruteo) {
            ch.bindQueue(q.queue, ex, "#."+regla_ruteo+".#");
          });
          setTimeout(function() { conn.close(); process.exit(0) }, 3000);
        });
          
      }
    });
  }
});