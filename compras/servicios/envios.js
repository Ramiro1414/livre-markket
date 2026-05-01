class EnviosService {

    solicitarFormaEnvio(compra) {
        compra.estado = 'forma_envio_solicitada';
        compra.formaDeEntrega = Math.random() > 0.5 ? 'retira' : 'correo';

        if (compra.formaDeEntrega === 'correo')
            compra.costo = Math.random() * 1e3;
        else
            compra.costo = 0;
        
        return compra;
    }

    seleccionarFormaEntrega(compra, forma_entrega) {
        compra.forma_entrega = forma_entrega
        compra.estado = 'forma_entrega_seleccionada'

        return compra
    }

    calcularCostoEnvio(compra) {
        compra.estado = 'envio_calculado';
        if (compra.forma_entrega === 'correo')
            compra.costo = Math.random() * 1e3;
        else
            compra.costo = 0;

        return compra
    }

    generarEnvio(compra) {
        compra.estado = 'enviado';
        return compra;
    }
}

module.exports = EnviosService;