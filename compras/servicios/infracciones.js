class InfraccionesService {
    detectarInfracciones(compra) {
        compra.estado = 'detectando_infracciones';
        compra.hasPublicacion = Math.random() > 0.7 ? true : false;
        return compra
    }

    cancelarInfraccionDetectada(compra) {
        compra.estado = 'pedido_cancelado';
        compra.motivo = 'tuvo Publicaciones';
        return compra
    }
}

module.exports = InfraccionesService;