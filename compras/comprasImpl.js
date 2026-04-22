#!/usr/bin/env node

const sleep = require('atomic-sleep')

var compraId = 0;

const ComprasService = require('./servicios/compras');
const PedidosService = require('./servicios/pedidos');
const InfraccionesService = require('./servicios/infracciones');
const PagosService = require('./servicios/pagos');
const EnviosService = require('./servicios/envios');

class CompraWorkflow {

  constructor() {
    this.servicioCompras = new ComprasService();
    this.servicioPedidos = new PedidosService();
    this.servicioInfracciones = new InfraccionesService();
    this.servicioPagos = new PagosService();
    this.servicioEnvios = new EnviosService();
    this.compra = new Object();
  }

  iniciarCompra(producto) {

    compraId++;

    console.log('Arranca ',producto,'time: ',new Date().toISOString());

    let compra = this.servicioCompras.seleccionarProducto(producto, compraId);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioPedidos.generarPedido(compra);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioInfracciones.detectarInfracciones(compra);
    sleep(Math.floor(Math.random() * 1e3));

    if (compra.hasPublicacion) {
      compra = this.servicioInfracciones.cancelarInfraccionDetectada(compra)
      sleep(Math.floor(Math.random() * 1e3));
      this.compra = compra;
      return compra;
    }

    // no hubo infracciones, reserva el producto
    compra = this.servicioCompras.reservarProducto(compra);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioEnvios.solicitarFormaEnvio(compra);
    sleep(Math.floor(Math.random() * 1e3));
    
    compra = this.servicioEnvios.calcularCostoEnvio(compra);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioCompras.confirmarCompra(compra);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioPagos.solicitarMedioPago(compra);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioPagos.pagarProducto(compra);
    sleep(Math.floor(Math.random() * 1e3));

    if (compra.resultadoPago === 'rechazado') {
      compra = this.servicioPagos.cancelarPagoRechazado(compra);
      sleep(Math.floor(Math.random() * 1e3));
      this.compra = compra;
      return compra;
    }

    compra = this.servicioPagos.confirmarPago(compra);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioEnvios.generarEnvio(compra);
    sleep(Math.floor(Math.random() * 1e3));

    compra = this.servicioCompras.finalizarCompra(compra);
    this.compra = compra;
  }

}

module.exports = CompraWorkflow;


