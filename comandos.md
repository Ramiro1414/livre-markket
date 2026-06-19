# comandos para la demo

## Reservar producto de compra 1 (ya fue reservado antes)
curl -X POST http://localhost:3004/publicaciones -H "Content-Type: application/json" -d '{"evento": "reservar_producto", "compra_id": 1, "producto": "producto 1"}'

## Cancelar reserva producto de compra 1 (la compra ya finalizo)
curl -X POST http://localhost:3004/publicaciones -H "Content-Type: application/json" -d '{"evento": "cancelar_reserva_producto", "compra_id": 1, "producto": "producto 1"}'

## Reservar producto de compra 6 (no existe la compra)
curl -X POST http://localhost:3004/publicaciones -H "Content-Type: application/json" -d '{"evento": "reservar_producto", "compra_id": 6, "producto": "producto 1"}'
