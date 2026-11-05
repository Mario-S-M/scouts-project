# Login con validaciones, límite de intentos y nueva vista

Áreas: Frontend

> **Estado:** Reemplazada por `login-con-validaciones-limite-de-intentos-y-nueva-vista-2.md`
> **Fecha:** 2026-11-04
> **Origen:** GrillMe No. 0002 (`specs/grill/0002-login-con-validaciones-limite-de-intentos-y-nueva-vista.md`), decisiones aprobadas por Mario.

## Objetivo

Que el inicio de sesión valide bien los datos en el frontend y en el backend, encuentre las cuentas sin importar mayúsculas, limite los intentos por IP y correo, y tenga una vista accesible con la identidad del Grupo.

## Contexto

Cómo está hoy el código (revisado el 2026-11-04):

**Frontend**

- `frontend/src/app/features/auth/login/login.component.ts` usa `[(ngModel)]` con `email` y `password`, sin `<form>`. Valida solo que no estén vacíos y, si hay error, muestra en un **toast** (`MessageService`) el texto que manda el backend (`err.error.message`).
- `login.component.html` tiene el emoji `⚜️` como logo, inputs con `(keyup.enter)`, sin `autocomplete` y sin botón para ver la contraseña.
- `login.component.scss` fija el botón en azul `#2563EB` con `!important`. El fondo es un degradado marino (`#0d1b33` → `#1B2A4A`) y la tarjeta usa `var(--surface-card)`.
- `frontend/src/app/features/auth/auth.module.ts` importa `FormsModule`, pero **no** `ReactiveFormsModule` ni `SharedModule`. Otros formularios del repo (`crear-solicitud`, `registro-caminante`, `crear-informe`, `crear-ciclo`) ya usan `FormBuilder`.
- `AuthInterceptor` (`core/interceptors/auth.interceptor.ts`) llama a `logout()` en cada 401, y eso navega a `/login`. En la pantalla de login no hace daño: se queda en la misma ruta y el error llega igual al componente. **No hay que cambiarlo.**
- `ThemeService` pone en `<body>` la clase `p-theme-aura-dark-blue` o `p-theme-aura-light-blue` y define `--surface-card`, `--text-color`, `--text-color-secondary` y `--surface-border` para los dos temas.
- `frontend/src/assets/images/logo-grupo.png` mide 300×300 y pesa 195 KB. También lo usan `core/services/seccion.service.ts` y `config-secciones.component.ts`, así que **no se reemplaza**: se agrega una copia reducida.
- `/api` es del mismo origen que el frontend: en producción pasa por `frontend/nginx.conf` y en desarrollo por `frontend/proxy.conf.json`. Por eso el navegador puede leer la cabecera `Retry-After` aunque CORS no la exponga.

**Backend**

- `backend/src/auth/dto/login.dto.ts` solo tiene `@IsEmail`, `@IsNotEmpty` e `@IsString`. `auth.service.ts` ya responde `'Credenciales inválidas'` tanto si la contraseña está mal como si el usuario está inactivo.
- `UsersService.findByEmail` (`backend/src/users/users.service.ts:20`) busca el correo exacto con `findOne({ where: { email } })`. Lo usan `auth.service.ts`, `create` (para ver si el correo ya existe), `update` (líneas 40-41) y `seedUsers` (línea 83), que corre **al arrancar** desde `main.ts`.
- `update` compara `data.email !== user.email` y guarda con `usersRepository.update(...)`, que **no** ejecuta hooks `@BeforeUpdate`.
- `caminantes.service.ts:79-96` crea el usuario de un joven con `userRepo.create` y `save`, sin pasar por `UsersService`. El correo llega desde `create-caminante.dto.ts:39`.
- La columna `email` de `backend/src/users/entities/user.entity.ts` es `@Column({ length: 200, unique: true })`. La restricción `unique` distingue mayúsculas.
- `main.ts` crea la app con `NestFactory.create(AppModule)` sin tipo, con un `ValidationPipe` global (`whitelist`, `transform`) y CORS `origin: '*'`. Hoy no hay `trust proxy`.
- `@nestjs/throttler` no está instalado. Los paquetes de Nest son la versión 10.
- `@Transform` de `class-transformer` ya se usa en `evidencias/dto/create-evidencia.dto.ts`.
- Existe `.env.example` en la raíz.

**Otros clientes del login**

- `mcp-server/src/api.ts` guarda el token en memoria y solo vuelve a iniciar sesión si no tiene token o si recibe un 401. Si el login falla, hoy muestra `Login fallido (<status>): revisa SCOUTS_EMAIL / SCOUTS_PASSWORD.`, y eso confunde cuando el error es un 429.
- El bot de Telegram corre dentro del backend y no llama al login.

**Despliegue**

- Producción está en la Raspberry (`raspberrypi.local`) y su BD es la fuente de verdad. También se entra por internet en `https://scouts.itsitarhiata.com`, a través de Cloudflare. No se sabe si `cloudflared` corre en el Pi, así que no se sabe cuántos proxies hay delante del backend.
- `nginx` manda `X-Real-IP` y `X-Forwarded-For` (`$proxy_add_x_forwarded_for`).
- El repo no tiene Jest ni Karma configurados (no hay script `test` ni archivos `*.spec.ts`).

**Identidad visual**

- Marino `#14265C`, oro `#EFC02F` y oro oscuro `#B8891A`, tomados de `informes.service.ts`.
- El texto marino sobre oro tiene un contraste de ≈ 8:1. El blanco sobre oro no llega a 4.5:1.

## Decisiones

1. **Formulario reactivo con errores por campo:** El login pasa a Reactive Forms dentro de un `<form>` real. Correo obligatorio, con formato válido, sin espacios y en minúsculas; contraseña obligatoria y sin longitud mínima. Los errores salen debajo de cada campo al salir de él o al intentar enviar, y el botón se bloquea mientras carga.
   - Por qué: Es la convención del repo (FormBuilder en otros formularios). Las contraseñas las genera el admin al azar y una regla de fuerza al entrar podría dejar fuera a alguien; esas reglas van donde se crean contraseñas.
2. **Validación del login en el backend:** `login.dto.ts` agrega @Transform (trim y minúsculas) en el correo, @MaxLength(254) en el correo y @MaxLength(128) en la contraseña, con mensajes en español. El 401 sigue siendo genérico ('Credenciales inválidas') para contraseña mala y para usuario inactivo.
   - Por qué: El backend no debe confiar solo en el frontend, y un mensaje genérico no revela qué correos existen.
3. **Correos sin distinguir mayúsculas:** `findByEmail` (users.service.ts) busca con QueryBuilder y `LOWER(email) = LOWER(:email)`, lo que sirve para el login y para revisar si un correo ya existe. Si encuentra dos cuentas que solo se distinguen por mayúsculas, rechaza el login de ambas y lo registra en el log.
   - Por qué: Hoy la búsqueda es exacta y puede haber correos guardados con mayúsculas. Pasarlos a minúsculas sin esto dejaría fuera a esas personas.
4. **Normalización del correo en un solo punto:** La columna `email` de la entidad User tiene un transformer que hace trim y minúsculas al escribir. Además, @Transform en create-user, update-user y create-caminante. El correo de tutores queda fuera porque no es una cuenta. No hay migración de los correos existentes.
   - Por qué: `caminantes.service` crea usuarios sin pasar por UsersService, y los hooks @BeforeUpdate no se ejecutan con `repository.update()`; el transformer cubre todas las rutas, incluido seedUsers.
5. **Revisar duplicados antes de desplegar:** Antes de desplegar se corre en la BD del Pi una consulta de solo lectura para encontrar correos que solo se distinguen por mayúsculas, y se resuelven a mano si los hay.
   - Por qué: No se pudo confirmar si existen, y si los hay, esas cuentas quedarían bloqueadas.
6. **Límite de intentos en el login:** Se agrega @nestjs/throttler (dependencia nueva), aplicado solo a POST /api/auth/login: 5 intentos por minuto contando por IP + correo normalizado, guardado en memoria. Responde 429 con el mensaje 'Demasiados intentos, espera un momento' y la cabecera Retry-After.
   - Por qué: El repo es público y la app se puede usar desde internet (Cloudflare). Contar por IP + correo evita que una reunión en el mismo Wi-Fi se bloquee entre sí.
7. **IP real detrás de Cloudflare y nginx:** Se activa `trust proxy` con el número de saltos real, que se averigua en el Pi con un log temporal de la IP que ve el backend (y que se borra después). No se confía en CF-Connecting-IP sin más.
   - Por qué: No se pudo confirmar si cloudflared corre en el Pi. Con un salto de menos, todos los usuarios de internet contarían como la misma IP, y esa cabecera se puede falsificar desde la red local.
8. **MCP y bot sin cambios:** El mcp-server ya guarda el token y solo vuelve a iniciar sesión ante un 401, y el bot de Telegram no usa el login, así que ninguno necesita excepción en el throttler. Lo único es que el MCP debe mostrar con claridad un 429 si llega a recibirlo.
   - Por qué: Una excepción por IP o por cabecera sería un hueco de seguridad en un repo público.
9. **Mensajes de error definidos por el frontend:** El frontend nunca muestra el texto del backend. 401 y 400 muestran 'Correo o contraseña incorrectos'; un error de red o un 5xx muestra 'No pudimos conectar con el servidor, revisa tu conexión'. Todo va en línea, con aria-live, en lugar del toast.
   - Por qué: Así no se filtran mensajes técnicos y los errores son accesibles para lectores de pantalla.
10. **Espera tras demasiados intentos:** Ante un 429 se lee Retry-After (60 s si no llega), el botón muestra una cuenta regresiva deshabilitado y los campos siguen editables. aria-live solo anuncia al empezar y al terminar la espera, no cada segundo.
    - Por qué: La persona sabe cuánto esperar y el lector de pantalla no repite el número cada segundo.
11. **Nueva vista con la identidad:** Se usan el marino #14265C y el oro #EFC02F en lugar del azul #2563EB fijo, con texto oscuro sobre el botón oro si hace falta por contraste. Se pone el logo del Grupo en versión reducida (unos 160 px, con width/height y alt) en lugar del emoji ⚜️. Se agrega un botón para mostrar u ocultar la contraseña (aria-label y aria-pressed) y autocomplete email/current-password. Debe funcionar en tema claro y oscuro y en el celular.
    - Por qué: El login es de todo el grupo, y el logo actual pesa 195 KB, lo que haría más lenta la primera carga. No hay una paleta del Grupo documentada; si Mario la tiene, se cambia después.
12. **Pruebas manuales y limpieza:** Solo se verifica a mano, con una lista escrita: correo con mayúsculas o espacios, contraseña mala, usuario inactivo, sexto intento → 429 con curl, validaciones y botón, temas, celular, teclado y lector de pantalla. Al terminar se borran las cuentas de prueba y los logs temporales.
    - Por qué: El repo no tiene Jest ni Karma configurados. Configurarlos es otra spec.
13. **Fuera de alcance:** No incluye 'Olvidé mi contraseña', 'Recordarme', reglas de fuerza de contraseña ni configurar pruebas automáticas.
    - Por qué: Las contraseñas las administra el admin, y lo demás es trabajo aparte.

### Precisiones de implementación (derivadas del código, no cambian las decisiones)

- **"En minúsculas" (decisión 1)** significa que el campo se **normaliza** con trim y minúsculas al salir de él y antes de enviar. No se muestra un error por escribir mayúsculas. Los errores del campo correo son tres: vacío, formato inválido y espacios en medio.
- **Duplicados (decisión 3):** si `findByEmail` encuentra más de una cuenta, **lanza** un error propio, `CorreoDuplicadoError`, y registra un `warn`. `auth.service` lo convierte en el 401 genérico, `create` y `update` en un 409, y `seedUsers` lo captura, lo registra y sigue con la siguiente cuenta, para que el backend no se caiga al arrancar. No devuelve `null`, porque entonces `create` dejaría registrar una tercera cuenta.
- **Saltos de proxy (decisión 7):** se leen de la variable `TRUST_PROXY_HOPS` (por defecto `1`, es decir, solo nginx). El valor real se fija en el `.env` del Pi sin reconstruir la imagen. El log temporal solo se activa con `LOG_IP_LOGIN=1` y va marcado con `// TEMPORAL`.
- **Los intentos (decisión 6) se cuentan todos**, incluidos los que entran bien. La clave del throttler normaliza `req.body.email` por su cuenta, porque el guard corre **antes** del `ValidationPipe`.

## Criterios de aceptación

**Backend**

- [ ] `POST /api/auth/login` con `"  Mario@Scouts.MX "` y la contraseña correcta devuelve 200 para la cuenta `mario@scouts.mx`.
- [ ] Una cuenta guardada con mayúsculas antes de este cambio (por ejemplo `Prueba@X.com`) entra escribiendo `prueba@x.com`.
- [ ] Una contraseña mala y un usuario inactivo devuelven 401 con el mismo cuerpo (`"Credenciales inválidas"`).
- [ ] Si hay dos cuentas que solo se distinguen por mayúsculas, las dos reciben 401 y el log del backend tiene una línea `warn` con el correo en minúsculas (sin contraseñas).
- [ ] El backend arranca aunque existan esas cuentas duplicadas: `seedUsers` registra el problema y sigue.
- [ ] Un correo de más de 254 caracteres o una contraseña de más de 128 devuelven 400 con mensajes en español.
- [ ] Crear o editar un usuario (`/api/users`) o dar de alta un joven con un correo con mayúsculas o espacios guarda el correo con trim y en minúsculas.
- [ ] Crear un usuario con `JUAN@x.com` cuando ya existe `juan@x.com` devuelve 409.
- [ ] Editar el propio correo cambiando solo las mayúsculas no devuelve "ya existe".
- [ ] El correo de tutores (`tutores.dto.ts`) no cambia.
- [ ] El 6.º intento en menos de un minuto con la misma IP y el mismo correo devuelve 429, con `"Demasiados intentos, espera un momento"` y la cabecera `Retry-After` en segundos.
- [ ] Mientras un correo está bloqueado, otro correo desde la misma IP sigue pudiendo intentar.
- [ ] Las demás rutas de `/api` no tienen límite de intentos.
- [ ] `trust proxy` usa `TRUST_PROXY_HOPS`, y en el Pi está fijado al número de saltos medido.
- [ ] El log temporal de IP ya no está en el código ni activo en el Pi.
- [ ] El MCP, al recibir un 429 en el login, muestra un error que dice que hay demasiados intentos y cuántos segundos esperar, no "revisa SCOUTS_EMAIL / SCOUTS_PASSWORD".
- [ ] `cd backend && npm run build` y `cd mcp-server && npm run build` terminan sin errores.

**Frontend**

- [ ] El login es un `<form>` con `formGroup`. Enter envía el formulario y no hay `(keyup.enter)`.
- [ ] Los errores salen debajo de su campo al salir de él o al intentar enviar, enlazados con `aria-describedby` y marcados con `aria-invalid`. No se usa toast.
- [ ] Al salir del campo correo, su valor queda con trim y en minúsculas.
- [ ] La contraseña no tiene longitud mínima.
- [ ] Mientras carga, el botón está deshabilitado y no se puede enviar dos veces.
- [ ] Un 401 o un 400 muestran "Correo o contraseña incorrectos".
- [ ] Un error de red (status 0) o un 5xx muestran "No pudimos conectar con el servidor, revisa tu conexión".
- [ ] Nunca se muestra el texto que manda el backend.
- [ ] Ante un 429, el botón deshabilitado cuenta los segundos de `Retry-After` (60 si no llega) y los campos siguen editables.
- [ ] El lector de pantalla solo anuncia la espera al empezar y al terminar.
- [ ] El botón principal es oro `#EFC02F` con texto marino `#14265C`. `#2563EB` ya no aparece en `login.component.scss`.
- [ ] Se ve el logo `logo-grupo-160.png` (160×160, menos de 40 KB) con `width`, `height` y `alt="Grupo Scout 7 Itsï Tarhiata"`. No queda el emoji.
- [ ] El botón de ver u ocultar la contraseña es `type="button"`, tiene `aria-label` y `aria-pressed`, y se puede usar con teclado.
- [ ] `autocomplete="email"` / `"current-password"` e `inputmode="email"` en el correo.
- [ ] Se ve y se lee bien en tema claro y oscuro, y a 375, 768 y 1280 px de ancho, sin scroll horizontal y con áreas táctiles de al menos 44 px. El foco se ve en los dos temas.
- [ ] `cd frontend && npm run build` termina sin errores.

**Operación**

- [ ] Antes de desplegar se revisaron los duplicados por mayúsculas en la BD del Pi (resultado anotado en el PR) y se resolvieron si los había.
- [ ] Se borraron las cuentas de prueba de la BD local y no quedaron artefactos de prueba.

## Tareas

### Tarea 1: Dependencia del throttler y helper común para normalizar correos

Agente: OpenCode

**Qué hacer**

- En `backend/`, instalar `@nestjs/throttler` en una versión compatible con `@nestjs/common` 10. La v6 lo es; hay que confirmarlo en los `peerDependencies` del paquete con `npm view @nestjs/throttler@6 peerDependencies`. Usar `npm install @nestjs/throttler@^6`.
- Crear `backend/src/common/normalizar-correo.ts` con:
  - `export function normalizarCorreo<T>(valor: T): T`: si `valor` es string, devuelve `valor.trim().toLowerCase()`; si no, lo devuelve sin tocar (`undefined` y `null` pasan igual).
  - `export const NormalizarCorreo = () => Transform(({ value }) => normalizarCorreo(value));`, con `Transform` importado de `class-transformer`.
  - Un comentario de una línea que diga que este es el único lugar donde está la regla.
- Esta tarea es la única que toca `package.json` y `package-lock.json`.

**Archivos:** `backend/package.json`, `backend/package-lock.json`, `backend/src/common/normalizar-correo.ts` (nuevo).

**Verificación**

- `cd backend && npm ls @nestjs/throttler` muestra la versión instalada sin errores de peer.
- `npm run build` compila.
- Prueba rápida: `npx ts-node -e "import {normalizarCorreo} from './src/common/normalizar-correo'; console.log(JSON.stringify([normalizarCorreo('  A@B.Com '), normalizarCorreo(undefined), normalizarCorreo(null)]))"` imprime `["a@b.com",null,null]`. `undefined` sale como `null` porque así lo serializa JSON dentro de un arreglo.

### Tarea 2: Validaciones de `LoginDto`

Agente: OpenCode
Depende de: Tarea 1

**Qué hacer:** en `backend/src/auth/dto/login.dto.ts` (seguir bros-back-validacion):

- En `email`: `@NormalizarCorreo()`, `@IsEmail({}, { message: 'El correo no tiene un formato válido' })` y `@MaxLength(254, { message: 'El correo no puede tener más de 254 caracteres' })`.
- En `password`: `@IsString({ message: 'La contraseña debe ser texto' })`, `@IsNotEmpty({ message: 'Escribe tu contraseña' })` y `@MaxLength(128, { message: 'La contraseña no puede tener más de 128 caracteres' })`.
- **No** agregar `MinLength`.

**Archivos:** `backend/src/auth/dto/login.dto.ts`.

**Verificación**

- `npm run build` compila.
- Con el backend en marcha, `curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$(printf 'a%.0s' {1..250})@x.com\",\"password\":\"x\"}"` devuelve 400 con el mensaje de 254 caracteres.
- Una contraseña de 129 caracteres devuelve 400 con el mensaje de 128.
- `{"email":"  A@B.COM ","password":"x"}` **no** da 400 (da 401).

### Tarea 3: Transformer en la columna `email` de `User`

Agente: OpenCode
Depende de: Tarea 1

**Qué hacer:** en `backend/src/users/entities/user.entity.ts`, cambiar la columna a

```ts
@Column({ length: 200, unique: true, transformer: { to: normalizarCorreo, from: (v: string) => v } })
email: string;
```

importando `normalizarCorreo` desde `../../common/normalizar-correo`.

- No cambia el esquema: no se agregan ni se quitan columnas, lo que importa porque producción usa `synchronize: true`.
- No se hace migración.

**Archivos:** `backend/src/users/entities/user.entity.ts`.

**Verificación**

- `npm run build` compila.
- Con el backend local en marcha, ver en el log de arranque que `synchronize` no altera la tabla `users`.
- Con la cuenta admin, crear por `POST /api/users` un usuario con `"  Temp.Prueba@X.com "`. Revisar con `psql` que quedó `temp.prueba@x.com` y después borrarlo.

### Tarea 4: `@NormalizarCorreo()` en los DTOs que crean o editan cuentas

Agente: OpenCode
Depende de: Tarea 1

**Qué hacer:** agregar `@NormalizarCorreo()` al campo `email`, encima de `@IsEmail()`, en:

- `create-user.dto.ts`
- `update-user.dto.ts`
- `create-caminante.dto.ts` (es opcional: el helper deja pasar `undefined`).

**No** tocar `backend/src/caminantes/dto/tutores.dto.ts`.

**Archivos:** `backend/src/users/dto/create-user.dto.ts`, `backend/src/users/dto/update-user.dto.ts`, `backend/src/caminantes/dto/create-caminante.dto.ts`.

**Verificación**

- `npm run build` compila.
- `git diff --stat` no muestra cambios en `tutores.dto.ts`.
- Dar de alta un joven de prueba en la BD local con `"Joven.Prueba@X.com"` y revisar en `users` que quedó en minúsculas. Borrar el joven y su usuario al terminar.

### Tarea 5: `findByEmail` sin distinguir mayúsculas y manejo de duplicados

Agente: Claude
Depende de: Tarea 1

**Qué hacer** (seguir bros-back-seguridad y bros-back-datos):

- En `users.service.ts`, crear y exportar `class CorreoDuplicadoError extends Error`, que guarda el correo normalizado.
- Reescribir `findByEmail(email)`:
  - Normalizar con `normalizarCorreo`.
  - Buscar con `createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).take(2).getMany()`.
  - Con 0 resultados devuelve `null`; con 1 devuelve el usuario.
  - Con 2 o más, registra con `Logger.warn` ("Hay cuentas cuyo correo solo difiere en mayúsculas: <correo>; resuélvelo a mano") y lanza `CorreoDuplicadoError`.
- `create`: si `findByEmail` lanza `CorreoDuplicadoError` o encuentra un usuario, responde `ConflictException('Ese correo ya está registrado')`.
- `update`:
  - Comparar los correos ya normalizados.
  - Considerar "ya existe" solo si el usuario encontrado tiene **otro** `id`.
  - `CorreoDuplicadoError` también da 409.
- `seedUsers`: envolver cada cuenta en `try/catch` de `CorreoDuplicadoError`. Registrar el problema y seguir con la siguiente cuenta, para que el backend no muera al arrancar.
- `auth.service.ts`: si `findByEmail` lanza `CorreoDuplicadoError`, responder `UnauthorizedException('Credenciales inválidas')`, el mismo cuerpo que para contraseña mala. El 401 genérico sigue igual para usuario inactivo.
- Nunca registrar contraseñas ni hashes.

**Archivos:** `backend/src/users/users.service.ts`, `backend/src/auth/auth.service.ts`.

**Verificación** (en la BD local, nunca en la del Pi)

- `npm run build` compila.
- Insertar con SQL directo una cuenta `Prueba.Mayus@X.com` (hash de una contraseña conocida). Entrar con `prueba.mayus@x.com` → 200.
- Insertar `prueba.mayus@x.com` como segunda cuenta:
  - El login con cualquiera de las dos variantes da 401 `Credenciales inválidas`.
  - El log muestra el `warn`.
  - Reiniciar el backend: arranca bien.
- `POST /api/users` con `PRUEBA.MAYUS@x.com` da 409.
- Editar una cuenta cambiando solo las mayúsculas de su correo → 200.
- Borrar las cuentas de prueba.

### Tarea 6: Límite de intentos en `POST /api/auth/login`

Agente: Claude
Depende de: Tarea 1

**Qué hacer** (seguir bros-back-seguridad):

- Crear `backend/src/auth/guards/login-throttler.guard.ts`, con `LoginThrottlerGuard extends ThrottlerGuard`.
  - Sobrescribir `getTracker(req)` para que devuelva `` `${req.ip}|${normalizarCorreo(req.body?.email) ?? ''}` ``. Recortar el correo a 254 caracteres y aceptar solo strings; cualquier otra cosa se cuenta como `''`.
  - El correo se normaliza aquí porque el guard corre antes del `ValidationPipe`.
- En `auth.module.ts`, importar `ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 5 }], errorMessage: 'Demasiados intentos, espera un momento' })`.
  - **Sin nombre** de throttler (o `default`). Con un nombre propio, la cabecera saldría como `Retry-After-<nombre>`.
  - `ttl` va en **milisegundos** en v5 y v6.
  - Confirmar los nombres de opciones contra la versión instalada (`node_modules/@nestjs/throttler/dist/throttler-module-options.interface.d.ts`).
  - El almacenamiento es en memoria, el que viene por defecto.
- En `auth.controller.ts`, poner `@UseGuards(LoginThrottlerGuard)` **solo** en `login`.
- **No** registrar `APP_GUARD`, para que el resto de la API no tenga límite.
- Sin excepciones por IP ni por cabecera.

**Archivos:** `backend/src/auth/guards/login-throttler.guard.ts` (nuevo), `backend/src/auth/auth.module.ts`, `backend/src/auth/auth.controller.ts`.

**Verificación** (backend local)

- `npm run build` compila.
- `for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"nadie@x.com","password":"mala"}'; done` imprime cinco `401` y un `429`.
- `curl -si ...` del 7.º intento muestra `Retry-After: <segundos>` y el cuerpo con `"Demasiados intentos, espera un momento"`.
- En ese mismo minuto, `{"email":"otro@x.com",...}` devuelve 401, no 429.
- `{"email":" NADIE@X.COM ",...}` sí devuelve 429, porque cuenta como el mismo correo.
- `GET /api/dashboard` con token, repetido 10 veces, nunca devuelve 429.

### Tarea 7: `trust proxy` configurable y log temporal de IP

Agente: OpenCode

**Qué hacer**

En `backend/src/main.ts`:

- Crear la app con `NestFactory.create<NestExpressApplication>(AppModule)`, importando `NestExpressApplication` de `@nestjs/platform-express`.
- Justo después:

```ts
const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
app.set('trust proxy', Number.isFinite(hops) && hops >= 0 ? hops : 1);

// TEMPORAL (spec login): averiguar cuántos proxies hay delante. Quitar en la Tarea 15.
if (process.env.LOG_IP_LOGIN === '1') {
  app.use('/api/auth/login', (req, _res, next) => {
    console.log('[TEMPORAL ip-login]', JSON.stringify({ ip: req.ip, ips: req.ips, xff: req.headers['x-forwarded-for'], cf: req.headers['cf-connecting-ip'] }));
    next();
  });
}
```

- No leer `CF-Connecting-IP` para nada más.

En `.env.example`, agregar con un comentario:

- `TRUST_PROXY_HOPS=1`: número de proxies delante del backend; 1 = solo nginx.
- `# LOG_IP_LOGIN=1`: solo para diagnóstico temporal.

**Archivos:** `backend/src/main.ts`, `.env.example`.

**Verificación**

- `npm run build` compila.
- Levantar el backend local con `LOG_IP_LOGIN=1` y hacer un login con `curl -H 'X-Forwarded-For: 9.9.9.9'`:
  - Con `TRUST_PROXY_HOPS=1`, el log muestra `ip: "9.9.9.9"`.
  - Con `TRUST_PROXY_HOPS=0`, muestra `::1` o `127.0.0.1`.
- Sin `LOG_IP_LOGIN` no se imprime nada.

### Tarea 8: El MCP explica un 429 al iniciar sesión

Agente: OpenCode
Depende de: Tarea 6

**Qué hacer:** en `mcp-server/src/api.ts`, dentro de `login()`, antes del `throw` genérico:

```ts
if (res.status === 429) {
  const espera = res.headers.get('retry-after') ?? '60';
  throw new Error(`Demasiados intentos de inicio de sesión en la app. Espera ${espera} segundos y vuelve a intentarlo.`);
}
```

- El mensaje actual (`revisa SCOUTS_EMAIL / SCOUTS_PASSWORD`) se queda para los demás códigos.
- No se cambia nada más: ni cómo se guarda el token ni los reintentos.

**Archivos:** `mcp-server/src/api.ts`.

**Verificación**

- `cd mcp-server && npm run build` compila.
- Con el backend local que ya tiene la Tarea 6, gastar los 5 intentos del correo del MCP con `curl` y una contraseña mala. Luego ejecutar `SCOUTS_API_URL=http://localhost:3000/api SCOUTS_EMAIL=<correo> SCOUTS_PASSWORD=<la buena> node -e "require('./dist/api').usuarioActual().catch(e=>console.log(e.message))"`. Debe imprimir el mensaje de demasiados intentos con los segundos.

### Tarea 9: Logo reducido del Grupo para el login

Agente: OpenCode

**Qué hacer**

- Generar `frontend/src/assets/images/logo-grupo-160.png` a partir de `logo-grupo.png` con `sips -Z 160 frontend/src/assets/images/logo-grupo.png --out frontend/src/assets/images/logo-grupo-160.png`.
- Si pesa 40 KB o más, comprimirlo con `pngquant` (`brew install pngquant`; `pngquant --force --output <archivo> --quality 70-90 <archivo>`) y conservar la transparencia.
- **No** modificar ni borrar `logo-grupo.png`: lo usan `seccion.service.ts` y `config-secciones`.

**Archivos:** `frontend/src/assets/images/logo-grupo-160.png` (nuevo).

**Verificación**

- `file frontend/src/assets/images/logo-grupo-160.png` dice `160 x 160` y `RGBA`.
- `ls -l` muestra menos de 40 KB.
- Abrirlo y comprobar que se ve nítido y sin fondo blanco.
- `git status` muestra solo el archivo nuevo.

### Tarea 10: Formulario reactivo del login: lógica, errores y plantilla

Agente: Claude

**Qué hacer**

En `frontend/src/app/features/auth/auth.module.ts`:

- Agregar `ReactiveFormsModule`.
- Quitar `FormsModule` y `PasswordModule` si ya no se usan.

Reescribir `login.component.ts` y `login.component.html` (seguir bros-front-estados y bros-front-accesibilidad). Hay que quitar `MessageService` y los toasts, y mantener la navegación de después de entrar tal como está.

**Contrato público** que usa la plantilla:

- `form: FormGroup<{ email: FormControl<string>; password: FormControl<string> }>`, creado con `FormBuilder.nonNullable`.
  - `email`: `Validators.required`, `Validators.email` y un validador `sinEspacios` (error `espacios` si el valor tiene espacios después del trim).
  - `password`: solo `Validators.required`.
- `loading: boolean`.
- `showPassword: boolean` y `togglePassword(): void`.
- `submitted: boolean`, que se pone en `true` al intentar enviar.
- `fieldError(campo: 'email' | 'password'): string | null`. Devuelve el texto del primer error si el control está `touched` o si `submitted` es `true`; si no, `null`.
- `normalizarCorreo(): void`. Se llama en `(blur)` del correo y pone el valor con trim y en minúsculas, sin marcar el campo como sucio a propósito.
- `errorMsg: string | null`: error del servidor que se ve en la tarjeta.
- `liveMsg: string`: texto de la región `aria-live`. Empieza como `''`.
- `segundosEspera: number`: si es mayor que 0, el botón está bloqueado y muestra la cuenta.
- `get bloqueado(): boolean`, que vale `loading || segundosEspera > 0`.
- `onSubmit(): void`.

**Textos exactos**

| Caso | Texto |
|---|---|
| Correo vacío | `Escribe tu correo` |
| Formato | `Revisa el correo, por ejemplo nombre@scouts.mx` |
| Espacios | `El correo no puede tener espacios` |
| Contraseña vacía | `Escribe tu contraseña` |
| 401 o 400 | `Correo o contraseña incorrectos` |
| Status 0 o ≥ 500 | `No pudimos conectar con el servidor, revisa tu conexión` |
| 429 al empezar | `Demasiados intentos. Espera N segundos e inténtalo de nuevo` |
| 429 al terminar | `Ya puedes intentarlo de nuevo` |

**Reglas**

- `onSubmit`:
  - Normaliza el correo y marca `submitted`.
  - Si el formulario es inválido, mueve el foco al primer campo con error y no envía.
  - Si `bloqueado`, no hace nada.
- Nunca leer `err.error.message`.
- Cualquier otro status (403, 404…) usa el mensaje de servidor caído.
- En el 429:
  - Leer `err.headers.get('Retry-After')`. Si no es un entero mayor que 0, usar 60.
  - Bajar `segundosEspera` cada segundo con un intervalo que se limpia al llegar a 0 y en `ngOnDestroy`.
  - `liveMsg` cambia **solo** al empezar y al terminar la espera.
  - `errorMsg` muestra el texto del inicio mientras dure la espera.
- En los errores 401/400 y de servidor caído, poner `liveMsg = errorMsg` para que se anuncien. Si el mensaje es el mismo que la vez anterior, vaciar `liveMsg` antes y asignarlo en el siguiente ciclo (`setTimeout(…, 0)`), para que el lector lo repita.
- Al empezar un envío nuevo, limpiar `errorMsg`.
- No se agregan dependencias.

**Plantilla** (en esta misma tarea, para que la rama compile sola)

Reescribir `login.component.html` usando solo el contrato de arriba. Las clases CSS que se nombran aquí son el contrato con la Tarea 11, la de estilos.

El archivo `logo-grupo-160.png` lo agrega la Tarea 9. Si todavía no está integrada, la imagen sale rota solo en esta rama, pero la compilación no falla.

**Estructura**

- `<main class="login-wrapper">` con `<section class="login-card" aria-labelledby="login-title">`. Se usa `<main>` porque `app.component.html` envuelve el `router-outlet` en un `<div>`, no en un `<main>`.
- En el encabezado:
  - `<img src="assets/images/logo-grupo-160.png" width="160" height="160" alt="Grupo Scout 7 Itsï Tarhiata" class="login-logo">`, sin `loading="lazy"` porque está en la primera pantalla.
  - `<h1 id="login-title" class="login-title">` con el título actual y el subtítulo `Scouts México` en minúsculas normales; las mayúsculas, si se quieren, van por CSS.
- `<form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="login-form">`.

**Correo**

- `<label for="email">Correo electrónico</label>`.
- `<input id="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" formControlName="email" pInputText (blur)="normalizarCorreo()">`.
- `[attr.aria-invalid]="!!fieldError('email')"` y `[attr.aria-describedby]="fieldError('email') ? 'email-error' : null"`.
- Debajo: `<small id="email-error" class="field-error">`, que solo se muestra si hay error (`*ngIf`).

**Contraseña**

- Igual que el correo, con `autocomplete="current-password"` y `[type]="showPassword ? 'text' : 'password'"`.
- Al lado, `<button type="button" class="toggle-password" (click)="togglePassword()" [attr.aria-pressed]="showPassword" [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'">` con el ícono `pi pi-eye` o `pi pi-eye-slash` y `aria-hidden="true"`.
- `id="password-error"` para su error.

**Errores del servidor y botón**

- `<p class="server-error">{{ errorMsg }}</p>` siempre presente en el DOM (sin `*ngIf` ni `role="alert"`), solo visual. Su espacio queda reservado aunque esté vacío.
- `<div class="sr-only" aria-live="polite" aria-atomic="true">{{ liveMsg }}</div>`, siempre en el DOM y nunca con `*ngIf`. Es lo único que se anuncia.
- Botón `type="submit"` con la clase `login-btn` y `[disabled]="bloqueado"`. Su texto:
  - `Iniciar sesión` normalmente.
  - `Entrando…` mientras carga.
  - `Espera {{ segundosEspera }} s` durante la espera, sin `aria-live`.
- Los campos **no** se deshabilitan durante la espera.
- Se mantiene el pie con el año.

**Archivos:** `frontend/src/app/features/auth/login/login.component.ts`, `frontend/src/app/features/auth/login/login.component.html`, `frontend/src/app/features/auth/auth.module.ts`.

**Verificación**

- `cd frontend && npm run build` compila.
- `grep -n "error.message\|ngModel\|MessageService" frontend/src/app/features/auth/login/*` no encuentra nada.
- Comparar el código con la tabla de textos.
- Con `npm start` y el backend local:
  - Tab recorre correo → contraseña → ojo → botón.
  - Enter en cualquier campo envía.
  - El ojo cambia `aria-pressed` y el tipo del campo.
  - Enviar vacío muestra los dos errores debajo de sus campos.
  - Con una contraseña mala, el mensaje aparece en la tarjeta y la región `aria-live` del DOM tiene el mismo texto.

### Tarea 11: Estilos del login con la identidad

Agente: OpenCode
Depende de: Tarea 9, Tarea 10

**Qué hacer:** reescribir `login.component.scss` (seguir bros-front-diseno y bros-front-rendimiento).

**Colores y fondo**

- Definir arriba variables SCSS: `$marino: #14265C`, `$oro: #EFC02F`, `$oro-osc: #B8891A`.
- Fondo `.login-wrapper` marino sólido o con un degradado sutil de marinos (`#0d1b33` → `$marino`), en los dos temas.
- `min-height: 100dvh`, con `100vh` como respaldo.
- `.login-card` usa `var(--surface-card)`, `var(--text-color)` y `var(--surface-border)`, para que se adapte al tema.

**Logo**

- `.login-logo` con `width: 7.5rem; height: auto`.

**Botón principal**

- `.login-btn`: fondo `$oro`, texto `$marino` en `font-weight: 700`, borde `$oro`.
- Hover: `$oro-osc`.
- Deshabilitado: opacidad 0.6 y `cursor: not-allowed`.
- Alto mínimo de 44 px.
- Quitar todo `#2563EB` y `#1d4ed8`. Usar `!important` solo si PrimeNG lo exige, y explicar por qué con un comentario.

**Errores y botón de la contraseña**

- `.field-error` y `.server-error`: color de error con contraste de al menos 4.5:1 en los dos temas. Por ejemplo, `#b91c1c` en claro y `#fca5a5` en oscuro. Cada uno lleva un ícono o un texto, no solo color.
- `.server-error` reserva su alto con `min-height`, para que el diseño no salte (CLS).
- `.toggle-password`: área de al menos 44×44 px, sin fondo, dentro del campo y a la derecha.

**Foco y accesibilidad**

- Foco con `:focus-visible`: `outline: 3px solid $oro; outline-offset: 2px` en el tema oscuro. En el tema claro, `:host-context(body.p-theme-aura-light-blue)` lo cambia a `$marino`, porque el oro sobre blanco no llega a 3:1.
- Clase `.sr-only` (visualmente oculta).
- `@media (prefers-reduced-motion: reduce)` sin transiciones.

**Celular**

- En menos de 400 px, el padding de la tarjeta baja y no hay scroll horizontal.
- Sin animaciones de entrada y sin sombras extra.

**Archivos:** `frontend/src/app/features/auth/login/login.component.scss`.

**Verificación**

- `npm run build` compila y no aumenta el aviso de presupuesto de estilos.
- `grep -n "2563EB\|1d4ed8" login.component.scss` no encuentra nada.
- En el navegador:
  - Revisar 375, 768 y 1280 px en el tema oscuro y en el claro. Para el claro, alternar el tema dentro de la app y luego cerrar sesión.
  - El foco se ve en los cuatro controles en los dos temas.
  - Medir el contraste del botón (marino sobre oro) y de los errores con las herramientas del navegador.

### Tarea 12: Revisar duplicados por mayúsculas en la BD del Pi

Agente: Claude

**Qué hacer:** solo lectura, sin cambiar datos (seguir bros-back-datos). Desde la Mac, en la red de casa:

```bash
ssh rasp@raspberrypi.local "cd /home/rasp/scouts-app && docker compose -f docker-compose.prod.yml exec -T postgres psql -U \$DB_USER -d \$DB_NAME -c \"SELECT LOWER(TRIM(email)) AS correo, COUNT(*), array_agg(id ORDER BY id) AS ids, array_agg(activo ORDER BY id) AS activos FROM users GROUP BY 1 HAVING COUNT(*) > 1;\""
```

- Si las variables no están en la sesión remota, tomar el usuario y la base del `.env` del Pi sin imprimir la contraseña.
- También contar cuántos correos tienen mayúsculas o espacios: `SELECT COUNT(*) FROM users WHERE email <> LOWER(TRIM(email));`.
- Si hay duplicados, **no** resolverlos por cuenta propia. Anotarlos (ids, si están activos, a qué cuenta corresponden) y pedirle a Mario que decida cuál se queda.

**Archivos:** ninguno del repo. El resultado se anota en la descripción del PR de la spec.

**Verificación**

- La salida de las dos consultas está pegada en el PR, sin datos sensibles más allá de ids y correos.
- Si hubo duplicados, Mario confirmó por escrito cómo se resolvieron antes de la Tarea 15.

### Tarea 13: Verificación manual del backend y limpieza

Agente: OpenCode
Depende de: Tarea 2, Tarea 3, Tarea 4, Tarea 5, Tarea 6, Tarea 7

**Qué hacer:** con todo integrado y el backend local en marcha (**BD local, nunca la del Pi**), recorrer esta lista y anotar el resultado (✅/❌ y la salida relevante) en el PR. Esperar 60 s entre bloques para que no se cruce el límite de intentos.

1. Login de `mario@scouts.mx` (o una cuenta de prueba creada para esto) con el correo escrito `"  Mario@Scouts.MX "` → 200.
2. Contraseña mala → 401 `Credenciales inválidas`.
3. Usuario de prueba inactivo (`activo=false`) → 401 con el mismo cuerpo que el punto 2.
4. Cuenta guardada con mayúsculas por SQL (`Vieja.Mayus@X.com`) entra escribiendo el correo en minúsculas → 200.
5. Dos cuentas que solo se distinguen por mayúsculas → las dos dan 401 y aparece el `warn`. Reiniciar el backend y comprobar que arranca.
6. Correo de 255 caracteres o contraseña de 129 → 400 en español.
7. El bucle de 6 intentos de la Tarea 6: cinco `401` y un `429`, y `curl -si` muestra `Retry-After`. Otro correo desde la misma IP → 401.
8. Crear un usuario con `JUAN.PRUEBA@x.com` cuando ya existe `juan.prueba@x.com` → 409. Editar el propio correo cambiando solo las mayúsculas → 200.

**Limpieza** (memoria del proyecto): borrar con SQL todas las cuentas de prueba creadas (ids anotados) y confirmar con `SELECT` que no queda ninguna.

**Archivos:** ninguno del repo.

**Verificación:** la lista completa está en el PR con los 8 puntos en ✅, y el `SELECT` final no devuelve cuentas de prueba.

### Tarea 14: Verificación manual del frontend

Agente: OpenCode
Depende de: Tarea 6, Tarea 11

**Qué hacer:** con frontend y backend locales integrados (`npm start` en los dos), recorrer y anotar en el PR. Se pueden usar capturas con Playwright.

1. **Validaciones:**
   - Enviar vacío muestra los dos errores.
   - `correo mal` muestra el error de espacios.
   - `nombre@` muestra el de formato.
   - Al salir del campo, `  Nombre@X.com ` queda como `nombre@x.com`.
   - Una contraseña de 1 carácter se acepta y se envía.
2. **Botón:** se deshabilita mientras carga. Para verlo, usar en DevTools *Network → Slow 3G* y hacer doble clic: se manda una sola petición.
3. **Errores del servidor:**
   - 401 muestra `Correo o contraseña incorrectos`.
   - Con el backend apagado, sale `No pudimos conectar con el servidor, revisa tu conexión`.
   - No aparece ningún toast.
4. **429:**
   - Seis intentos malos: el botón dice `Espera N s`, cuenta hacia atrás y los campos siguen editables.
   - Al llegar a 0, el botón vuelve a `Iniciar sesión`.
   - En el árbol de accesibilidad o en el DOM, la región `aria-live` cambia solo dos veces.
5. **Vista:**
   - Logo nítido y sin salto al cargar.
   - Botón oro con texto marino.
   - Tema oscuro y claro.
   - Anchos de 375, 768 y 1280 px, sin scroll horizontal.
6. **Teclado:** recorrer todo solo con Tab, Shift+Tab, Enter y Espacio. El foco se ve siempre.
7. **Lector de pantalla:** lo prueba **Mario con VoiceOver**. Hay que dejarle en el PR los pasos: activar VoiceOver, enviar el formulario vacío, escribir una contraseña mala y provocar el 429. Él marca el resultado.
8. **Rendimiento:** en *Network*, el logo pesa menos de 40 KB. Comparar el tamaño del chunk lazy de `auth` en `npm run build` antes y después: no debe crecer más de unos pocos KB.

**Limpieza:** no dejar capturas ni archivos de prueba dentro del repo. Si se crearon cuentas, borrarlas como en la Tarea 13.

**Archivos:** ninguno del repo.

**Verificación:** lista completa en el PR. Solo el punto 7 puede quedar pendiente, porque depende de Mario.

### Tarea 15: Despliegue, saltos reales de proxy y retiro del log temporal

Agente: Claude
Depende de: Tarea 8, Tarea 12, Tarea 13, Tarea 14

**Qué hacer** (seguir bros-back-seguridad y la memoria de despliegue):

1. Confirmar que la Tarea 12 no encontró duplicados o que ya se resolvieron. Respaldar la BD del Pi con `pg_dump` en `backups/`.
2. Desplegar con push a `main`, como siempre (`deploy.yml`).
3. En el `.env` del Pi, poner temporalmente `LOG_IP_LOGIN=1` y reiniciar solo el backend.
4. Hacer un login desde internet (datos móviles, `https://scouts.itsitarhiata.com`) y otro desde la red local (`raspberrypi.local`).
5. Leer `docker compose -f docker-compose.prod.yml logs backend | grep TEMPORAL`. Con `ips`/`xff` contar cuántos proxies propios hay delante:
   - Si solo está nginx, son 1 salto.
   - Si `cloudflared` (u otro) está en el Pi delante de nginx, son 2.
6. Elegir el número con el que `req.ip` sea la IP pública real del celular en el acceso por internet y no se pueda falsificar desde la red local. Probarlo con `curl -H 'X-Forwarded-For: 1.2.3.4'` desde la LAN: `req.ip` **no** debe ser `1.2.3.4`.
   - **Desempate:** si los dos objetivos piden números distintos, usar el **menor**, es decir, el que no se puede falsificar desde la red local. Por ejemplo, `cloudflared` en el Pi necesita 2 saltos para internet, pero `raspberrypi.local` entra directo a nginx. Anotar en el PR que, en ese caso, los accesos por internet comparten IP en el contador. La clave IP + correo sigue evitando que una cuenta bloquee a otra. Esto sigue la decisión 7: no confiar en cabeceras que se pueden falsificar.
7. Fijar `TRUST_PROXY_HOPS=<n>` en el `.env` del Pi y quitar `LOG_IP_LOGIN`.
8. En el repo, borrar de `backend/src/main.ts` el bloque `// TEMPORAL` y la línea `# LOG_IP_LOGIN` de `.env.example`. Ajustar ahí el comentario de `TRUST_PROXY_HOPS` con lo que se encontró, sin IPs. Redesplegar: al recrearse el contenedor desaparecen los logs con IPs.
9. Hacer en producción un `curl` de 6 intentos con un correo inexistente (`nadie.prueba@x.com`): cinco `401` y un `429`.

Esta es la única tarea, además de la 7, que toca `main.ts` y `.env.example`. Va al final y en secuencia.

**Archivos:** `backend/src/main.ts`, `.env.example` (y el `.env` del Pi, fuera del repo).

**Verificación**

- `grep -rn "TEMPORAL\|LOG_IP_LOGIN" backend/src .env.example` no encuentra nada.
- En el Pi, `grep -c TEMPORAL` sobre los logs del backend da 0.
- El 429 en producción está confirmado.
- En el PR quedan anotados el número de saltos elegido y por qué, sin IPs reales.
