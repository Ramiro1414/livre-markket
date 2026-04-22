class PagosService {

    solicitarMedioPago(compra) {
        compra.estado = 'medio_pago_solicitado'
        compra.medioPago = Math.random() > 0.5 ? 'efectivo' : 'tarjeta';
        return compra;
    }

    pagarProducto(compra) {
        compra.estado = 'pagando';
        compra.resultadoPago = Math.random() > 0.3 ? 'autorizado' : 'rechazado';
        return compra;
    }

    cancelarPagoRechazado(compra) {
        compra.estado = 'compra_cancelada';
        compra.motivo = 'Pago rechazado'
        return compra;
    }

    confirmarPago(compra) {
        compra.estado = 'pagado';
        return compra
    }
}

module.exports = PagosService;