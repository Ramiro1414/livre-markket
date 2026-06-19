# comandos para la demo

## Reservar producto de compra 1 (ya fue reservado antes)
curl -X POST http://localhost:3004/publicaciones -H "Content-Type: application/json" -d '{"evento": "reservar_producto", "compra_id": 1, "producto": "producto 1"}'

## 
