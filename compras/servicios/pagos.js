class PagosService {

    seleccionarMedioPago(compra, medio_pago) {
        compra.estado = 'medio_pago_seleccionado'
        compra.medioPago = medio_pago
        return compra;
    }

    autorizarPago(compra) {
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