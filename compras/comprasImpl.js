#!/usr/bin/env node

const sleep = require('atomic-sleep')

var compraId = 0;

class Compra {
  constructor() {
    this.compra = new Object();
  }

  seleccionarProducto(producto) {
    console.log('Arranca ',producto,'time: ',new Date().toISOString());
    
    compraId++;
    this.compra.compraId = compraId;
    this.compra.producto = producto;
    this.compra.estado = 'producto_seleccionado';
    sleep(Math.floor(Math.random() * 1e3));

    this.generarPedido();
  }


  generarPedido() {
    this.compra.estado = 'pedido_generado';
    sleep(Math.floor(Math.random() * 1e3));

    this.detectarInfracciones();
  }

  detectarInfracciones() {
    this.compra.estado = 'detectando_infracciones';
    this.compra.hasPublicacion = Math.random() > 0.7 ? true : false;
    sleep(Math.floor(Math.random() * 1e3));

    if (this.compra.hasPublicacion) {
      this.cancelarInfraccionDetectada();
      //compra.imprimirCompra();
    } else {
      // no hubo infracciones, reserva el producto
      this.reservarProducto();
    }
  }

  cancelarInfraccionDetectada() {
    this.compra.estado = 'pedido_cancelado';
    this.compra.motivo = 'tuvo Publicaciones';
    sleep(Math.floor(Math.random() * 1e3));
  }

  reservarProducto() {
    this.compra.estado = 'producto_reservado';
    sleep(Math.floor(Math.random() * 1e3));

    this.solicitarFormaEnvio();
  }

  solicitarFormaEnvio() {
    this.compra.estado = 'forma_envio_solicitada';
    this.compra.formaDeEntrega = Math.random() > 0.5 ? 'retira' : 'correo';
    sleep(Math.floor(Math.random() * 1e3));

    this.calcularCostoEnvio(this.compra.formaDeEntrega);
  }

  calcularCostoEnvio(entrega) {
    this.compra.estado = 'envio_calculado';
    if (entrega === 'correo')
      this.compra.costo = Math.random() * 1e3;
    else
      this.compra.costo = 0;

    sleep(Math.floor(Math.random() * 1e3));

    this.confirmarCompra();
  }

  confirmarCompra() {
    this.compra.estado = 'compra_confirmada';
    this.compra.compraConfirmada = true;
    sleep(Math.floor(Math.random() * 1e3));

    this.solicitarMedioPago();
  }

  solicitarMedioPago() {
    this.compra.estado = 'medio_pago_solicitado'
    this.compra.medioPago = Math.random() > 0.5 ? 'efectivo' : 'tarjeta';
    sleep(Math.floor(Math.random() * 1e3));

    this.pagarProducto();

  }

  pagarProducto() {
    this.compra.estado = 'pagando';
    this.compra.resultadoPago = Math.random() > 0.3 ? 'autorizado' : 'rechazado';
    sleep(Math.floor(Math.random() * 1e3));

    if (this.compra.resultadoPago === 'rechazado') {
      this.cancelarPagoRechazado();
    } else {
      this.confirmarPago();
    }
  }

  cancelarPagoRechazado() {
    this.compra.estado = 'compra_cancelada';
    this.compra.motivo = 'Pago rechazado'
    sleep(Math.floor(Math.random() * 1e3));

  }

  confirmarPago() {
    this.compra.estado = 'pagado';
    sleep(Math.floor(Math.random() * 1e3));

    this.generarEnvio();
  }

  generarEnvio() {
    this.compra.estado = 'enviado';
    sleep(Math.floor(Math.random() * 1e3));

    this.finalizarCompra();
  }

  finalizarCompra() {
    this.compra.estado = 'finalizada';
  }
}

module.exports = Compra;


