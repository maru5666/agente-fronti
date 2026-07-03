# fronti-backend

Backend MVP de Fronti AI, un agente empresarial venezolano para empresas que operan principalmente desde WhatsApp.

## Stack

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Axios
- `@nestjs/config`
- Arquitectura modular

## Instalacion

```bash
npm install
```

Si tu entorno tiene npm en modo offline, ejecuta:

```bash
npm install --offline=false
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta la conexion PostgreSQL y Google Maps:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fronti_backend?schema=public"
PORT=3000
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_GEOCODING_URL="https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_MAPS_DISTANCE_MATRIX_URL="https://maps.googleapis.com/maps/api/distancematrix/json"
GOOGLE_MAPS_DIRECTIONS_URL="https://maps.googleapis.com/maps/api/directions/json"
BCV_SOURCE_URL="https://www.bcv.org.ve/"
BCV_EXCHANGE_URL="https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv"
```

Activa en Google Maps Platform las APIs Geocoding y Distance Matrix.

## Prisma

Generar cliente Prisma:

```bash
npm run prisma:generate
```

Crear y ejecutar migracion:

```bash
npm run prisma:migrate -- --name init
```

Abrir Prisma Studio:

```bash
npm run prisma:studio
```

## Pruebas

Ejecutar pruebas del sistema modular de Skills:

```bash
npm run test:skills
```

## Estabilidad obligatoria

Antes de cerrar cualquier cambio del backend, ejecuta desde la raiz del proyecto:

```bash
npm run verify:stability
```

Para comprobar que backend y admin pueden iniciar en modo desarrollo sin errores:

```bash
npm run verify:stability:dev
```

La regla completa del proyecto esta documentada en:

```bash
docs/PROJECT_STABILITY_POLICY.md
```

## Solucion de errores PostgreSQL/Prisma

Si el backend no queda corriendo en `http://localhost:3000` y aparece:

```bash
PrismaClientInitializationError: Authentication failed against database server
errorCode: P1000
```

la causa es que `DATABASE_URL` tiene usuario, password, puerto o base de datos incorrectos.

En Windows local, PostgreSQL suele estar instalado en:

```bash
C:\Program Files\PostgreSQL\16\bin
```

Ejemplo recomendado para este proyecto:

```bash
DATABASE_URL="postgresql://postgres:TU_PASSWORD_REAL@localhost:5432/fronti_db?schema=public"
```

Otros ejemplos validos:

```bash
DATABASE_URL="postgresql://postgres:miPassword@127.0.0.1:5432/fronti_db?schema=public"
DATABASE_URL="postgresql://fronti_user:miPassword@localhost:5432/fronti_db?schema=public"
DATABASE_URL="postgresql://postgres:miPassword@localhost:5433/fronti_db?schema=public"
```

Para crear la base de datos si no existe:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres -h localhost -p 5432 fronti_db
```

Si tienes PostgreSQL 18 en el puerto `5433`, usa:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -h localhost -p 5433 fronti_db
```

Para verificar la conexion:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fronti_db
```

Despues de corregir `.env`, ejecuta:

```bash
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

Notas:

- No asumas que la password es `postgres`; usa la password que configuraste al instalar PostgreSQL.
- En este workspace PostgreSQL 16 escucha en `5432` y PostgreSQL 18 escucha en `5433`.
- El backend solo queda activo si Prisma puede conectarse correctamente durante `onModuleInit`.

## Ejecutar

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:3000`.

## Solucionar EADDRINUSE en Windows

Si aparece este error:

```bash
EADDRINUSE: address already in use :::3000
```

significa que otro proceso ya esta usando el puerto `3000`.

Para ver que proceso ocupa el puerto:

```powershell
netstat -ano | findstr :3000
```

Busca el PID en la ultima columna. Luego detenlo:

```powershell
taskkill /PID TU_PID /F
```

Ejemplo:

```powershell
taskkill /PID 12345 /F
```

Tambien puedes cambiar el puerto del backend en `.env`:

```bash
PORT=3001
```

Despues reinicia el backend:

```bash
npm run start:dev
```

Si prefieres levantar el backend en otro puerto sin cerrar el proceso que usa `3000`, ejecuta:

```bash
npm run start:dev:3001
```

## Endpoints

### Companies

- `POST /companies`
- `GET /companies`
- `GET /companies/:id`

```json
{
  "name": "Bodega La Esquina",
  "rif": "J-12345678-9",
  "phone": "+584121234567",
  "address": "San Cristobal, Tachira",
  "latitude": 7.7669,
  "longitude": -72.225
}
```

### Products

- `POST /products`
- `GET /products/company/:companyId`
- `GET /products/company/:companyId/search?query=arroz`
- `GET /products/company/:companyId/low-stock`
- `PATCH /products/:id`
- `DELETE /products/:id`

Los productos pueden tener marca, imagen principal, portada y galeria visual:

```json
{
  "companyId": "uuid",
  "brandId": "uuid",
  "name": "Crema hidratante",
  "description": "Hidratacion diaria",
  "category": "Skincare",
  "mainImage": "https://example.com/producto.webp",
  "coverImage": "https://example.com/portada.webp",
  "galleryImages": [
    "https://example.com/foto-1.webp",
    "https://example.com/foto-2.png"
  ],
  "priceUsd": 12,
  "stock": 20,
  "minStock": 5
}
```

Formatos permitidos para imagenes: `jpg`, `jpeg`, `png`, `webp`.

### Brands

- `POST /brands`
- `GET /brands/company/:companyId`
- `PATCH /brands/:id`
- `DELETE /brands/:id`

```json
{
  "companyId": "uuid",
  "name": "CeraVe",
  "logo": "https://example.com/logo.webp",
  "description": "Marca de cuidado facial"
}
```

### Promotions

- `POST /promotions`
- `GET /promotions/company/:companyId/active`
- `PATCH /promotions/:id`
- `DELETE /promotions/:id`

### Sales

- `POST /sales`
- `GET /sales/company/:companyId`

Las ventas descuentan inventario al crearse.

### BCV

- `GET /bcv/latest`
- `POST /bcv/sync`

`GET /bcv/latest` devuelve la tasa oficial BCV del dia si ya fue consultada. Si no hay una tasa de hoy, intenta sincronizar contra `BCV_EXCHANGE_URL` y `BCV_SOURCE_URL`.

`POST /bcv/sync` fuerza una nueva consulta al Banco Central de Venezuela.

Si el sitio del BCV no responde, el backend usa la ultima tasa guardada. Si no existe ninguna tasa previa, responde:

```json
{
  "message": "Tasa BCV no disponible. Intenta actualizar."
}
```

Respuesta exitosa:

```json
{
  "id": "uuid",
  "currency": "USD",
  "rate": 36.5,
  "source": "Banco Central de Venezuela",
  "publishedAt": "2026-06-14T12:00:00.000Z",
  "fetchedAt": "2026-06-14T17:00:00.000Z",
  "createdAt": "2026-06-14T17:00:00.000Z",
  "fromFallback": false
}
```

Los productos usan la tasa BCV disponible para calcular:

```bash
priceUsd * rate = priceBs
```

### Payment Methods

- `POST /payment-methods`
- `GET /payment-methods/company/:companyId`
- `PATCH /payment-methods/:id`
- `DELETE /payment-methods/:id`

```json
{
  "companyId": "uuid",
  "name": "Pago movil",
  "type": "pago_movil",
  "currency": "VES",
  "description": "Banco, telefono y cedula del comercio"
}
```

### Delivery Zones

- `POST /delivery-zones`
- `GET /delivery-zones/company/:companyId`
- `PATCH /delivery-zones/:id`
- `DELETE /delivery-zones/:id`

```json
{
  "companyId": "uuid",
  "name": "La Concordia",
  "priceUsd": 2,
  "priceBs": 72,
  "estimatedTime": "20 minutos",
  "maxDistanceKm": 5
}
```

### Branches

Sucursales por empresa. Preparan a Fronti para operar multiples sedes, rutas, inventario y delivery por ubicacion.

- `POST /branches`
- `GET /branches/company/:companyId`
- `PATCH /branches/:id`
- `DELETE /branches/:id`

```json
{
  "companyId": "uuid",
  "name": "Sede principal",
  "address": "Barrio Obrero, San Cristobal",
  "phone": "04247678278",
  "isMain": true
}
```

### Orders

- `POST /orders`
- `GET /orders/company/:companyId`
- `GET /orders/company/:companyId/status/:status`
- `PATCH /orders/:id/status`

Estados: `pending`, `confirmed`, `paid`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`.

El pedido calcula subtotal, delivery y total. El stock se descuenta cuando el pedido pasa a `confirmed` o `paid`.

```json
{
  "companyId": "uuid",
  "customerName": "Maria Perez",
  "customerPhone": "+584121234567",
  "customerAddress": "Barrio Obrero, San Cristobal",
  "deliveryZoneId": "uuid",
  "paymentMethodId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    }
  ]
}
```

Para confirmar:

```json
{
  "status": "confirmed"
}
```

### Fronti

- `POST /fronti/chat`
- `GET /fronti/skills`

Request:

```json
{
  "companyId": "uuid",
  "senderPhone": "+584121234567",
  "message": "Quiero delivery a La Concordia",
  "customerLatitude": 7.7701,
  "customerLongitude": -72.2244
}
```

Fronti puede responder sobre productos, precios, inventario bajo, promociones, ventas, metodos de pago, delivery, direcciones, costo de envio, tiempo estimado y pedidos por texto.

#### Toma de pedidos conversacional

Fronti funciona como agente de atencion y toma de pedidos. Clasifica intenciones como producto/menu, precio, pedido, delivery, reclamo y ayuda. Cuando detecta compra, extrae datos desde mensajes informales y arma un borrador antes de guardar.

Ejemplo:

```json
{
  "companyId": "uuid",
  "senderPhone": "+584121234567",
  "message": "quiero un tropical para ana en av siempre viva 456 pago movil"
}
```

Fronti transforma el mensaje en un borrador interno:

```json
{
  "producto": "Tropical",
  "cantidad": 1,
  "cliente": "Ana",
  "direccion": "av siempre viva 456",
  "estado": "pending_confirmation"
}
```

Luego responde con una confirmacion del pedido. Solo cuando el cliente responde `SI`, Fronti crea el pedido real en `Order`. Si responde `NO`, cancela el borrador sin guardar la orden.

Datos minimos solicitados:

- producto
- cantidad
- nombre
- direccion
- telefono
- metodo de pago

El telefono puede venir del canal WhatsApp mediante `senderPhone`.

#### Integraciones de notificacion

Al confirmar un pedido, Fronti puede notificar al negocio mediante webhooks opcionales:

```env
FRONTI_ORDER_WEBHOOK_URL=
MAKE_ORDER_WEBHOOK_URL=
TELEGRAM_ORDER_WEBHOOK_URL=
```

Estas URLs permiten conectar Make, Google Sheets, Telegram o APIs internas sin cambiar el flujo principal. Si no estan configuradas, el pedido se guarda igual y la notificacion queda en logs internos.

### Fronti Skills

Fronti usa un registro modular de Skills. Cada Skill vive en su propia carpeta dentro de `src/fronti/skills`, tiene README y pruebas, y se activa automaticamente segun la intencion y el contexto de la conversacion.

Skills iniciales:

- Direccion
- Google Maps
- OCR BCV
- Inventario
- Pedidos
- Facturacion
- Delivery
- Memoria de clientes
- Recomendaciones
- Promociones

Para agregar una nueva Skill:

1. Crear una carpeta en `src/fronti/skills/nueva-skill`.
2. Implementar el contrato `FrontiSkill`.
3. Agregar README y prueba `*.spec.ts`.
4. Registrar la Skill en `FrontiModule` y `SkillsRegistryService`.

Cada interaccion guarda logs internos con intencion, herramienta, Skill utilizada, resultado, revision del Critic Agent y respuesta final.

## Reglas implementadas

- Todas las consultas filtran por `companyId`.
- Fronti no inventa productos.
- Los metodos de pago y zonas de delivery son configurables por empresa.
- Si el metodo de pago no existe para la empresa, Fronti responde que no esta disponible.
- Si la zona no existe, Fronti pide seleccionar una zona disponible.
- Google Maps valida direcciones, calcula distancia y genera el enlace de navegacion del repartidor.
- Las ubicaciones frecuentes se guardan en `CustomerAddress`.
- Los mensajes conversacionales se guardan en `ChatMessage`.
- Los DTOs validan los datos de entrada con `class-validator`.
