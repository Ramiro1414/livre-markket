class ComprasService {

  seleccionarProducto(producto, compraId) {
    let compra = new Object();
    compra.id = compraId;
    compra.producto = producto;
    compra.estado = 'producto_seleccionado';
    return compra;
  }

  reservarProducto(compra) {
    compra.estado = 'producto_reservado';
    return compra
  }

  cancelarReservaProducto(compra) {
    return compra;
  }

  confirmarCompra(compra) {
    compra.estado = 'compra_confirmada';
    compra.compraConfirmada = true;
    return compra
  }

  finalizarCompra(compra) {
    compra.estado = 'finalizada';
    return compra
  }
}

module.exports = ComprasService;