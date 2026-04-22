class EnviosService {

    solicitarFormaEnvio(compra) {
        compra.estado = 'forma_envio_solicitada';
        compra.formaDeEntrega = Math.random() > 0.5 ? 'retira' : 'correo';
        return compra;
    }

    calcularCostoEnvio(compra) {
        compra.estado = 'envio_calculado';
        if (compra.formaDeEntrega === 'correo')
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