class PedidosService {
    generarPedido(compra) {
        compra.estado = 'pedido_generado'
        return compra
    }
}

module.exports = PedidosService;