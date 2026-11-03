# SPEC 01 — Solicitud de insignias por caminante

> **Estado:** Implementado
> **Depende de:** ninguna
> **Fecha:** 2026-09-22
> **Objetivo:** Registrar en la app una solicitud de insignias por caminante, con catálogo editable de ítems solicitables, y generar su PDF con los logos del Grupo y de la Comunidad.

---

## 1 — Por qué existe esta spec

Hoy la app calcula qué insignias le corresponden a cada caminante (`insignias.service.ts`), pero no hay forma de **pedir el material físico**. El pedido se hace fuera de la app y no queda registro de qué se solicitó, para quién ni cuándo.

Esta spec cubre ese hueco: un registro persistente de solicitudes más un documento imprimible.

Dos decisiones del dominio que no son obvias y quedan fijadas aquí:

- **Ejes temáticos y senderos son insignias distintas.** El código actual los trata como sinónimos (`Cenit` ↔ `Salud y Bienestar` en `subir-evidencia.component.ts:36-41`). Para el catálogo de solicitud son 8 ítems separados, no 4.
- **En el kit de pañoleta solo las motas son obligatorias.** Todo lo demás —escudo de grupo, número de grupo, sector, la pañoleta misma y la flor de lis— se pacta caso por caso. El chico normalmente ya trae su pañoleta.

---

## 2 — Alcance

**Dentro:**

- Entidad `CatalogoInsignia` con CRUD completo: lista de ítems solicitables, editable desde la app.
- Seed inicial del catálogo con 17 ítems (4 progresión, 4 ejes temáticos, 4 senderos, 3 cintas de comunidad, 1 cordón de mando, 1 kit de pañoleta).
- Entidad `SolicitudInsignias` (cabecera, una por caminante) y `SolicitudInsigniasLinea` (ítem + cantidad).
- Componentes del kit de pañoleta como selección por línea, con validación de que `motas` siempre está incluida.
- Endpoint de sugerencias: dado un caminante, devuelve qué ítems del catálogo ya tiene ganados según su progreso registrado.
- PDF de la solicitud con logo del Grupo y logo de la Comunidad, reutilizando el patrón de `InformesService`.
- Endpoints de preview (sin guardar) y descarga (de solicitud guardada), como en `CiclosProgramaController`.
- Pantallas Angular dentro del feature `insignias` ya existente: listado, alta/edición y administración del catálogo.
- Control de acceso por rol con `RolesGuard` y `@Roles(...)`, que ya existen en `backend/src/auth/`.

**Fuera de alcance (para specs futuras):**

- Estados del pedido (borrador / enviada / recibida / entregada). Esta versión solo guarda el registro.
- Precios, subtotales y totales. El aspecto financiero vive en los informes mensuales.
- Solicitudes en lote con varios caminantes en un mismo documento.
- Que marcar una solicitud escriba de vuelta en `insignias.otorgada` o `fechaOtorgada`. La solicitud **no** modifica el progreso.
- Cinta de patrulla. Se descartó: en Comunidad son cintas de comunidad.
- Insignias por especialidad individual. Se solicita el eje completo, no cada camino.
- Envío del PDF por correo o por Telegram.

---

## 3 — Modelo de datos

Tres entidades nuevas en `backend/src/insignias/entities/`.

### `CatalogoInsignia` → tabla `catalogo_insignias`

```ts
export type CategoriaCatalogo =
  | 'progresion'       // Obsidiana, Jade, Opalo, Diamante
  | 'eje_tematico'     // Salud y Bienestar, Habilidades para la Vida, ...
  | 'sendero'          // Cenit, Cima, Cumbre, Cuspide
  | 'cinta_comunidad'  // Integrante, Coordinador, Subcoordinador
  | 'cordon_mando'     // Cordón de mando
  | 'kit_panoleta';    // Kit de pañoleta

@Entity('catalogo_insignias')
export class CatalogoInsignia {
  id: number;
  categoria: CategoriaCatalogo;  // enum
  nombre: string;                // length 200
  descripcion: string | null;    // length 500, nullable
  claveProgreso: string | null;  // length 50, nullable — ver abajo
  orden: number;                 // default 0
  activo: boolean;               // default true
}
```

`claveProgreso` es lo que permite sugerir. Vale `Obsidiana` / `Jade` / `Opalo` / `Diamante` para los ítems de progresión, y `Cenit` / `Cima` / `Cumbre` / `Cuspide` tanto para los senderos como para sus ejes temáticos correspondientes. En cintas, cordón y kit va en `null`.

### `SolicitudInsignias` → tabla `solicitudes_insignias`

```ts
@Entity('solicitudes_insignias')
export class SolicitudInsignias {
  id: number;
  caminanteId: number;        // FK → users.id
  caminante: User;            // ManyToOne
  fecha: Date;                // type 'date', default hoy
  seccion: string;            // length 100
  solicitanteId: number;      // FK → users.id, quien crea
  solicitante: User;          // ManyToOne
  observaciones: string | null; // type 'text', nullable
  createdAt: Date;            // CreateDateColumn
  lineas: SolicitudInsigniasLinea[]; // OneToMany, cascade
}
```

`solicitanteId` sale de `req.user.id`. `seccion` **no** viaja en el JWT —el payload es `{ sub, email, rol, nombre }` (`auth.service.ts:22`)— así que se copia de `caminante.seccion`, que sí está poblado para los scouts. Ninguno de los dos se captura a mano.

Para filtrar el listado por sección hace falta el camino inverso: rol del solicitante → sección. Se reutiliza `getSeccionFromRol(rol)` de `backend/src/common/rol-seccion.util.ts`, que **ya existe** y hace exactamente esto. No se escribe un helper nuevo. Su mapa:

```
jefe_manada | sub_jefe_manada       → 'manada'
jefe_tropa | sub_jefe_tropa         → 'tropa'
jefe_comunidad | sub_jefe_comunidad → 'comunidad'
jefe_clan | sub_jefe_clan           → 'clan'
roles de grupo (jefe_grupo, etc.)   → null (ven todas las secciones)
```

### `SolicitudInsigniasLinea` → tabla `solicitud_insignias_lineas`

```ts
export type ComponenteKit =
  | 'motas'          // obligatorio, no se puede quitar
  | 'escudo_grupo'
  | 'numero_grupo'
  | 'sector'         // el que dice "Michoacán"
  | 'panoleta'
  | 'flor_de_lis';

@Entity('solicitud_insignias_lineas')
export class SolicitudInsigniasLinea {
  id: number;
  solicitudId: number;            // FK → solicitudes_insignias.id, onDelete CASCADE
  solicitud: SolicitudInsignias;  // ManyToOne
  catalogoItemId: number;         // FK → catalogo_insignias.id
  catalogoItem: CatalogoInsignia; // ManyToOne, eager
  cantidad: number;               // default 1
  componentesKit: ComponenteKit[] | null; // type 'simple-array', nullable
  notas: string | null;           // length 300, nullable
}
```

`componentesKit` solo se llena cuando `catalogoItem.categoria === 'kit_panoleta'`. En cualquier otra línea va `null`.

### Reglas del kit de pañoleta

`ComponenteKit` es un enum **fijo en código**, no filas del catálogo editable. La obligatoriedad de `motas` es una regla de negocio y no debe poder desactivarse editando una tabla.

| Componente | ¿Obligatorio? | Estado inicial en el formulario |
| ---------- | ------------- | ------------------------------- |
| `motas` | Sí, fijo | activado y deshabilitado |
| `escudo_grupo` | No | activado |
| `numero_grupo` | No | activado |
| `sector` | No | activado |
| `panoleta` | No | desactivado |
| `flor_de_lis` | No | desactivado |

El backend rechaza con `400` cualquier línea de kit cuyo `componentesKit` no incluya `motas`.

### Seed del catálogo (17 ítems)

| Categoría | Ítems | `claveProgreso` |
| --------- | ----- | --------------- |
| `progresion` | Obsidiana, Jade, Ópalo, Diamante | mismo nombre sin acento |
| `eje_tematico` | Salud y Bienestar, Habilidades para la Vida, Medio Ambiente y Sustentabilidad, Paz y Acción Comunitaria | `Cenit`, `Cuspide`, `Cima`, `Cumbre` |
| `sendero` | Cenit, Cima, Cumbre, Cúspide | mismo nombre sin acento |
| `cinta_comunidad` | Integrante de Comunidad, Coordinador, Subcoordinador | `null` |
| `cordon_mando` | Cordón de Mando | `null` |
| `kit_panoleta` | Kit de Pañoleta | `null` |

La correspondencia eje ↔ sendero sale de `subir-evidencia.component.ts:36-41`, que ya es la fuente de verdad del proyecto.

El seed se ejecuta al arrancar el backend, como `usersService.seedUsers()` en `main.ts:35`. Es idempotente: solo inserta los ítems que no existan por `(categoria, nombre)`.

### Regla de sugerencia

`GET /api/insignias/solicitudes/sugerencias/:caminanteId` devuelve los `catalogoItemId` que el caminante ya tiene ganados:

- **Progresión:** filas de `insignias` con `otorgada = true`, empatadas por `tipo` contra `claveProgreso`.
- **Senderos y ejes temáticos:** un sendero cuenta como completo cuando tiene **5 o más** filas en `sendero_progreso` con `completado = true`, que es la regla que ya aplica `countSenderosCompletos` (`insignias.service.ts:241-255`). Cada sendero completo sugiere dos ítems: el de categoría `sendero` y el de categoría `eje_tematico` que comparten `claveProgreso`.
- **Cintas, cordón y kit:** nunca se sugieren. No dependen del progreso.

---

## 4 — Plan de implementación

1. Crear las tres entidades en `backend/src/insignias/entities/` (`catalogo-insignia.entity.ts`, `solicitud-insignias.entity.ts`, `solicitud-insignias-linea.entity.ts`) y registrarlas en DOS sitios: `TypeOrmModule.forFeature` de `insignias.module.ts` (para los repositorios) **y el arreglo `entities` de `backend/src/common/database.config.ts`** (para el DataSource). Ese arreglo es explícito, no hay autocarga: si falta el segundo, el backend compila pero revienta al arrancar con `EntityMetadataNotFoundError`. Con `synchronize: true` las tablas se crean al arrancar. Prueba: el backend levanta y las tres tablas existen en PostgreSQL.

2. Añadir `seedCatalogo()` en `insignias.service.ts` y llamarlo desde `main.ts`, junto a `seedUsers()`. Prueba: reiniciar el backend dos veces deja exactamente 17 filas en `catalogo_insignias`.

3. Crear los DTO en `backend/src/insignias/dto/`: `catalogo-insignia.dto.ts` y `solicitud-insignias.dto.ts`, con `class-validator`. El DTO de línea valida que `componentesKit` incluya `motas` cuando la categoría es `kit_panoleta`.

4. Crear `catalogo-insignias.controller.ts` con `@Controller('insignias/catalogo')` —**prefijo propio, no métodos añadidos a `InsigniasController`**, ver el riesgo de colisión de rutas— y su servicio `catalogo-insignias.service.ts`. Rutas: `GET`, `POST`, `PUT /:id`, `DELETE /:id`. Borrar marca `activo = false` en vez de eliminar la fila, para no romper solicitudes históricas. Protección con `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(...)` con esta lista exacta del enum `UserRole`: `JEFE_GRUPO`, `JEFE_MANADA`, `SUB_JEFE_MANADA`, `JEFE_TROPA`, `SUB_JEFE_TROPA`, `JEFE_COMUNIDAD`, `SUB_JEFE_COMUNIDAD`, `JEFE_CLAN`, `SUB_JEFE_CLAN`. Prueba: un usuario con rol `scout` recibe `403` al hacer `POST`.

5. Crear `solicitudes-insignias.service.ts` con el CRUD de solicitudes: `findAll` (filtrado por sección salvo `jefe_grupo`), `findOne`, `create`, `update`, `remove`. Las líneas se guardan en cascada. Prueba: crear una solicitud por API y recuperarla con sus líneas.

6. Añadir `getSugerencias(caminanteId)` al mismo servicio, con la regla de la sección 3. Prueba: un caminante con 5 caminos de `Cenit` completados recibe los ids de "Cenit" y "Salud y Bienestar".

7. Crear `solicitudes-insignias.controller.ts` con `@Controller('insignias/solicitudes')` y las rutas `GET`, `GET /sugerencias/:caminanteId`, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id`. `sugerencias` se declara **antes** de `:id` dentro del archivo, igual que `catalogo/progresion` en `informes.controller.ts:27-30`. Registrar ambos controllers nuevos en `insignias.module.ts` **antes** de `InsigniasController` en el arreglo `controllers`. Prueba: `GET /api/insignias/solicitudes` devuelve una lista, no un `400` de `ParseIntPipe`.

8. Añadir `generatePdf(solicitud)` al servicio. Carga los logos con el mismo bloque de `InformesService` (líneas 115-126: preferir `logo_Grupo_pdf.png` y `logo_CC_pdf.png`, caer a las versiones grandes, convertir a data URI). Encabezado con los dos logos y el título; cuerpo con la cabecera de datos y la tabla de ítems agrupada por categoría; pie con la identidad del Grupo y el folio de página. Paleta: azul `#14265C` y oro `#EFC02F`. Prueba: `GET /:id/pdf` descarga un PDF que abre sin errores y muestra ambos logos.

9. Añadir `POST /api/insignias/solicitudes/pdf-preview`, que arma una solicitud temporal desde el DTO sin guardarla, igual que `previewPdf` en `ciclos-programa.controller.ts:71-93`.

10. Frontend: crear `solicitud-insignias.model.ts` en `core/models/` y `solicitudes-insignias.service.ts` en `core/services/`, con los métodos contra los endpoints anteriores.

11. Frontend: añadir `JefeSeccionGuard` a `core/guards/role.guard.ts`, junto al `JefeGrupoGuard` que ya vive ahí. Deja pasar los nueve roles listados en el paso 4 y bloquea al resto. Prueba: un usuario `scout` que navegue a `/insignias/solicitudes` es redirigido.

12. Frontend: página `pages/listado-solicitudes/` en el feature `insignias`, con tabla PrimeNG de solicitudes (caminante, fecha, número de ítems) y botones de ver PDF, editar y borrar. Ruta `/insignias/solicitudes` en `insignias-routing.module.ts`, con `canActivate: [AuthGuard, JefeSeccionGuard]`.

13. Frontend: página `pages/crear-solicitud/`. Selector de caminante, fecha, observaciones, y selección de ítems agrupada por categoría. El selector de caminante lista solo los scouts cuya `seccion` coincide con la del solicitante según `AuthService.getSeccion(rol)`; para `jefe_grupo` lista todos. Al elegir caminante llama a `sugerencias` y premarca esos ítems, editables. El kit de pañoleta despliega sus seis casillas con `motas` marcada y deshabilitada. Botones de previsualizar PDF y guardar. Rutas `/insignias/solicitudes/nueva` y `/insignias/solicitudes/:id`, con el mismo `canActivate`.

14. Frontend: página `pages/catalogo-insignias/` con la tabla del catálogo y su diálogo de alta/edición. Ruta `/insignias/catalogo`, con `canActivate: [AuthGuard, JefeSeccionGuard]`.

15. Añadir las entradas de menú a la navegación principal, condicionadas por rol igual que el resto de los ítems del menú.

---

## 5 — Criterios de aceptación

- [x] Al arrancar el backend por primera vez, `catalogo_insignias` contiene 17 filas; al reiniciar sigue conteniendo 17.
- [x] El catálogo incluye 4 ítems de categoría `eje_tematico` y 4 de categoría `sendero`, con nombres distintos entre sí.
- [x] `GET /api/insignias/solicitudes` y `GET /api/insignias/catalogo` devuelven listas, no `400` de `ParseIntPipe`.
- [x] `GET /api/insignias/3` sigue devolviendo las insignias del caminante 3, como antes de esta spec.
- [x] `POST /api/insignias/catalogo` con un usuario de rol `scout` responde `403`.
- [x] `POST /api/insignias/catalogo` con un usuario de rol `sub_jefe_comunidad` responde `201`.
- [x] `DELETE /api/insignias/catalogo/:id` deja la fila en la tabla con `activo = false` y las solicitudes que la referencian siguen abriendo sin error.
- [x] Crear una solicitud con una línea de kit de pañoleta sin `motas` en `componentesKit` responde `400`.
- [x] Crear una solicitud con una línea de kit que contenga solo `motas` responde `201`.
- [x] `GET /api/insignias/solicitudes/sugerencias/:id` de un caminante con 5 caminos de `Cenit` completados devuelve los ids de "Cenit" y de "Salud y Bienestar".
- [x] `GET /api/insignias/solicitudes/sugerencias/:id` de un caminante sin progreso devuelve una lista vacía.
- [x] `GET /api/insignias/solicitudes/:id/pdf` descarga un PDF que abre en un lector estándar.
- [x] Ese PDF muestra el logo del Grupo y el logo de la Comunidad en el encabezado.
- [x] Ese PDF muestra nombre del caminante, fecha, sección, quién solicita y las observaciones.
- [x] Ese PDF lista los ítems agrupados por categoría, y la línea del kit enumera los componentes elegidos.
- [x] `POST /api/insignias/solicitudes/pdf-preview` devuelve un PDF y no crea ninguna fila en `solicitudes_insignias`.
- [x] En `/insignias/solicitudes/nueva`, elegir un caminante premarca los ítems sugeridos y se pueden desmarcar.
- [x] En esa pantalla, la casilla `motas` del kit está marcada y no se puede desmarcar.
- [x] En esa pantalla, el selector de caminante de un `sub_jefe_comunidad` no lista scouts de manada.
- [x] Un `sub_jefe_comunidad` ve en `/insignias/solicitudes` solo las de su sección; `jefe_grupo` las ve todas.
- [x] Un usuario con rol `scout` que navegue a `/insignias/solicitudes` es redirigido por `JefeSeccionGuard`.
- [x] Borrar una solicitud elimina también sus filas en `solicitud_insignias_lineas`.
- [~] Las tres pantallas se ven correctamente en tema oscuro y en tema claro. **Parcial:** las tres verificadas en oscuro; en claro solo la de alta de solicitud.

---

## 6 — Decisiones tomadas y descartadas

- **Sí:** una solicitud por caminante. Es como se lleva el control en la sección; un documento por muchacho.
- **No:** solicitud en lote con varios caminantes. Se consideró y se descartó por ahora; entra en otra spec si el volumen lo pide.
- **No:** estados del pedido. El valor inmediato es tener el registro y el documento, no seguir el ciclo logístico.
- **No:** precios ni totales. El dinero ya se lleva en los informes mensuales; duplicarlo aquí crea dos verdades.
- **Sí:** catálogo editable en BD. Lo eligió el usuario sobre la alternativa de constante en código: permite agregar ítems sin deploy.
- **Sí:** componentes del kit como enum fijo en código, no como filas del catálogo. La regla "las motas siempre van" es de negocio y no debe poder romperse editando una tabla.
- **Sí:** solo `motas` obligatoria. El usuario lo confirmó explícitamente frente a la alternativa de exigir también el escudo de grupo. Escudo, número, sector, pañoleta y flor de lis se pactan.
- **Sí:** `escudo_grupo`, `numero_grupo` y `sector` arrancan activados en el formulario; `panoleta` y `flor_de_lis`, desactivados. **Esto no lo confirmó el usuario** —la opción que eligió no traía tabla de defaults— es una propuesta basada en el caso común: el chico ya trae pañoleta y la flor de lis es opcional. Cámbialo al releer si no es así.
- **Sí:** ejes temáticos y senderos como 8 ítems distintos, aunque el código actual los trata como uno solo. Son parches físicos separados.
- **Sí:** borrado lógico en el catálogo (`activo = false`). Un borrado real dejaría solicitudes históricas apuntando a la nada.
- **Sí:** sugerencia automática editable. Leer el progreso ahorra trabajo, pero la última palabra la tiene quien arma el pedido.
- **No:** que la solicitud escriba en `insignias.otorgada`. Solicitar no es otorgar; mezclarlo corrompería el cálculo de progresión.
- **No:** cinta de patrulla. Estaba en la petición original y el usuario la retiró: en Comunidad son cintas de comunidad.
- **Sí:** vivir dentro del feature `insignias` existente en vez de crear un feature nuevo. Comparte dominio, servicio y módulo.
- **Sí:** reutilizar `RolesGuard` y `@Roles(...)` de `backend/src/auth/`. Ya están y ya se usan en `users.controller.ts`.
- **Sí:** controllers nuevos con prefijo propio (`insignias/catalogo`, `insignias/solicitudes`) en vez de métodos añadidos a `InsigniasController`. Evita la colisión con su `@Get(':caminanteId')`.
- **No:** incluir `SUB_JEFE_GRUPO` y `COLABORADOR_GRUPO` entre los roles con permiso. No se preguntó y no son roles de sección; si hacen falta, se agregan al arreglo de `@Roles(...)` sin cambiar nada más.
- **Sí:** reutilizar `getSeccionFromRol` de `common/rol-seccion.util.ts` en vez de escribir otro mapa rol → sección. Ya existe y ya cubre los roles de grupo.
- **Sí:** `seccion` de la solicitud copiada de `caminante.seccion`, no derivada del rol de quien la crea. La sección del muchacho es la autoritativa y el JWT no la lleva.
- **No:** replicar un formato oficial de la Provincia. No existe uno que haya que imitar; el documento se diseña con la identidad del Grupo.

---

## 7 — Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| `InsigniasController` ya tiene `@Get(':caminanteId')` con `ParseIntPipe`: `/api/insignias/solicitudes` podría caer ahí y responder `400` | Los controllers nuevos declaran prefijo completo (`insignias/catalogo`, `insignias/solicitudes`) y se registran antes de `InsigniasController` en el arreglo `controllers` del módulo. Hay un criterio de aceptación para cada una de las tres rutas. |
| `synchronize: true` crea las tablas en desarrollo pero no en producción | El paso 1 documenta las tres tablas; para el Pi se genera el SQL a mano antes de desplegar. |
| Un caminante sin `seccion` poblada deja la solicitud con sección vacía y desaparece del listado filtrado | El alta rechaza con `400` si `caminante.seccion` está vacía, con mensaje que pide completar el perfil del scout. |
| Los logos `_pdf` no están en la imagen Docker del backend | El bloque de carga cae a `logo_Grupo.png` y `logo_CC.png`, y si tampoco están imprime el escudo de respaldo, igual que hace hoy `InformesService`. |
| El catálogo editable permite duplicar ítems o inventar categorías | `categoria` es un enum en la entidad, no texto libre. El alta valida que `(categoria, nombre)` no exista ya. |
| La correspondencia eje ↔ sendero se edita en el catálogo y deja de cuadrar | La sugerencia empata por `claveProgreso`; si queda en `null` el ítem simplemente no se sugiere, no revienta. |
| Las respuestas de solicitudes incluyen el hash de contraseña de `caminante` y `solicitante` | Pendiente. Es un patrón preexistente (`/api/caminantes` hace lo mismo), pero conviene cerrarlo: `/api/users` ya lo filtra y sirve de modelo. Ver la spec de seguimiento. |
| Un caminante con progreso cargado a medias recibe sugerencias incompletas | Las sugerencias se premarcan pero son editables; nunca bloquean el alta manual de una línea. |

---

## Lo que **no** está en esta spec

- Estados del pedido: borrador, enviada, recibida, entregada.
- Precios, subtotales y totales.
- Solicitudes en lote con varios caminantes.
- Escribir de vuelta en `insignias.otorgada` o `fechaOtorgada` al entregar el material.
- Cinta de patrulla.
- Insignias por especialidad individual.
- Envío del PDF por correo o por Telegram.

Cada una de esas, si entra, va en su propia spec.
