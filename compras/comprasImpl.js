#!/usr/bin/env node

//const sleep = require('atomic-sleep')

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

  async iniciarCompra(producto) {

    compraId++;

    console.log('Arranca ', producto, 'time: ', new Date().toISOString());

    let compra = this.servicioCompras.seleccionarProducto(producto, compraId);
    await sleep(Math.random() * 1000);

    compra = this.servicioPedidos.generarPedido(compra);
    await sleep(Math.random() * 1000);

    const [
      compraConInfracciones,
      compraConReserva,
      compraConEnvio,
      compraConPago
    ] = await Promise.all([

      (async () => {
        let c = this.servicioInfracciones.detectarInfracciones({ ...compra });
        await sleep(Math.random() * 1000);
        return c;
      })(),

      (async () => {
        let c = this.servicioCompras.reservarProducto({ ...compra });
        await sleep(Math.random() * 1000);
        return c;
      })(),

      (async () => {
        let c = this.servicioEnvios.solicitarFormaEnvio({ ...compra });
        await sleep(Math.random() * 1000);
        return c;
      })(),

      (async () => {
        let c = this.servicioPagos.solicitarMedioPago({ ...compra });
        await sleep(Math.random() * 1000);
        return c;
      })()

    ]);

    // merge de tareas paralelizadas
    compra = {
      ...compra,
      ...compraConReserva,
      ...compraConEnvio,
      ...compraConPago,
      ...compraConInfracciones
    };

    // si hay infraccion, cancelo compra
    if (compra.hasPublicacion) {
      compra = this.servicioInfracciones.cancelarInfraccionDetectada(compra);
      compra = this.servicioCompras.cancelarReservaProducto(compra);
      this.compra = compra;
      return compra;
    }

    compra = this.servicioCompras.confirmarCompra(compra);
    await sleep(Math.random() * 1000);

    compra = this.servicioPagos.pagarProducto(compra);
    await sleep(Math.random() * 1000);

    // si se rechaza el pago, cancelo compra
    if (compra.resultadoPago === 'rechazado') {
      compra = this.servicioPagos.cancelarPagoRechazado(compra);
      compra = this.servicioCompras.cancelarReservaProducto(compra);
      this.compra = compra;
      return compra;
    }

    compra = this.servicioPagos.confirmarPago(compra);
    await sleep(Math.random() * 1000);

    compra = this.servicioEnvios.generarEnvio(compra);
    await sleep(Math.random() * 1000);

    compra = this.servicioCompras.finalizarCompra(compra);

    this.compra = compra;
  }

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = CompraWorkflow;


