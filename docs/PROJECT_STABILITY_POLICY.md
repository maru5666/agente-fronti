# Política de estabilidad de Fronti

Esta política es obligatoria para cualquier cambio en Fronti Admin, Fronti Backend y sus integraciones.

## Prioridad del proyecto

1. Estabilidad.
2. Seguridad de datos.
3. Experiencia de usuario.
4. Diseño visual.
5. Nuevas funcionalidades.

Ninguna mejora visual o funcional puede aprobarse si deja el sistema con compilación rota, rutas inaccesibles, errores de consola, estados inconsistentes, problemas de codificación o dependencias faltantes.

## Regla principal

Antes de declarar una tarea como terminada, se debe identificar la causa raíz del problema corregido y verificar que el cambio no rompió módulos relacionados.

No se aceptan soluciones temporales, reinicios manuales como respuesta permanente, cambios aislados sin validar impacto, ni parches que oculten el error sin resolverlo.

## Criterios mínimos antes de cerrar una tarea

- La causa raíz fue identificada.
- El backend compila correctamente.
- El frontend compila correctamente.
- Prisma Client se genera correctamente.
- Las migraciones aplican sin dejar drift.
- No existen módulos faltantes.
- No existen errores TypeScript.
- No existen errores críticos de Next.js.
- No existen problemas de hidratación conocidos.
- No existen caracteres corruptos de codificación.
- `.next` puede eliminarse y el admin vuelve a compilar desde cero.
- Los endpoints modificados responden correctamente.
- Las rutas afectadas cargan sin pantalla en blanco.
- Los cambios son compatibles con funcionalidades existentes.

## Comando obligatorio de verificación

Desde la raíz del proyecto:

```bash
npm run verify:stability
```

Este comando ejecuta:

- Auditoría UTF-8.
- Limpieza de `.next`.
- `prisma generate`.
- Build del backend NestJS.
- Pruebas de Skills del backend.
- Revisión de codificación en base de datos.
- Build del frontend Next.js desde cero.
- Auditoría UTF-8 final.

Para comprobar que los servidores de desarrollo pueden iniciar:

```bash
npm run verify:stability:dev
```

Este comando usa puertos temporales para no depender de procesos existentes:

- Backend: `3100`
- Admin: `3102`

## Política de causa raíz

Cada corrección debe explicar:

- Qué falló.
- Dónde falló.
- Por qué falló.
- Qué se cambió.
- Qué se verificó.
- Qué riesgo residual queda, si existe.

## Política de compatibilidad

Cuando un cambio afecte modelos, DTOs, endpoints, estados, servicios compartidos, sesión, layout, estilos globales, Prisma o variables de entorno, también se deben revisar los módulos consumidores.

Ejemplos:

- Si cambia `OrderStatus`, revisar Pedidos, Dashboard, Fronti Chat y OrdersService.
- Si cambia `Company`, revisar login, registro, sesión y configuración.
- Si cambia `Product`, revisar Productos, Catálogo, Chat, Pedidos y Facturación.
- Si cambia delivery, revisar Maps, Orders, Chat, Dashboard y notificaciones internas.

## Prohibiciones

- No ocultar errores técnicos dejando el flujo roto.
- No mostrar errores técnicos al usuario final.
- No corregir una pantalla rompiendo otra.
- No dejar builds fallando.
- No dejar imports muertos o módulos faltantes.
- No introducir textos corruptos por encoding.
- No usar valores inventados para delivery, pagos, BCV, inventario o precios.
- No aprobar una tarea solo porque "funciona en caliente" si no compila desde cero.

## Resultado esperado

Fronti debe mantenerse como un producto robusto, estable y profesional, preparado para operar con miles de empresas sin depender de arreglos manuales o reinicios constantes.
