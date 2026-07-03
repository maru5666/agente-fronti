# fronti-admin

Panel administrativo web para Fronti AI.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Axios
- React Hook Form
- Zod

## Instalacion

```bash
npm install
```

Si tu entorno usa npm offline:

```bash
npm install --offline=false --cache .npm-cache
```

## Variables de entorno

Copia `.env.local.example` a `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Ejecutar

Con el backend NestJS corriendo en `http://localhost:3000`:

```bash
npm run dev
```

Para trabajar con el backend en `3000`, usa el admin en `3002`:

```bash
npm run dev -- -p 3002
```

Abre `http://localhost:3002`.

## Flujo de sesion

El backend actual no tiene autenticacion. Para este MVP:

- Registro de empresa llama `POST /companies`.
- Login valida `GET /companies/access/:identifier` usando el ID de la empresa o RIF.
- La sesion se guarda en `localStorage` con `fronti_company_id`, `fronti_workspace_code` y `fronti_company_name`.

## Pantallas

- Login
- Registro de empresa
- Dashboard
- Productos
- Catalogo
- Categorias
- Inventario
- Clientes
- Pedidos
- Promociones
- Metodos de pago
- Zonas de delivery
- Proveedores
- Reportes
- Configuracion de empresa
- Chat de prueba con Fronti

## Catalogo visual

La pantalla `/catalogo` muestra una vitrina tipo ecommerce para revisar productos con:

- Imagen principal y galeria.
- Marca.
- Logo de marca cuando exista.
- Precio USD y precio en bolivares usando BCV.
- Disponibilidad.
- Promociones activas.
- Filtros por estado y marca.
- Productos destacados, nuevos y en promocion.
- Vista detalle con productos relacionados.
- Estado vacio con bienvenida, ejemplos visuales y acceso para agregar el primer producto.

La vitrina usa la identidad configurada en `/configuracion`:

- Nombre comercial.
- Logo de empresa.
- Color principal.
- Banner de catalogo.

## Notas funcionales

- Productos, promociones, metodos de pago, zonas de delivery, pedidos, reportes, clientes y chat consumen el backend NestJS.
- Categorias y proveedores usan almacenamiento local porque el backend aun no expone modulos dedicados para esas entidades.
- Todas las vistas incluyen estados de carga, error o vacio.

## Estabilidad obligatoria

Antes de dar por terminada cualquier tarea del admin, ejecuta desde la raiz del proyecto:

```bash
npm run verify:stability
```

Para comprobar que los servidores de desarrollo inician sin errores:

```bash
npm run verify:stability:dev
```

La politica completa esta en:

```bash
docs/PROJECT_STABILITY_POLICY.md
```
