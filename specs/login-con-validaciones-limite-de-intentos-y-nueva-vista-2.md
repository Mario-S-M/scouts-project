# Login con validaciones, límite de intentos y nueva vista

Áreas: Frontend

> **Estado:** Aprobado
> **Fecha:** 2026-11-04
> **Origen:** GrillMe No. 0002 (`specs/grill/0002-login-con-validaciones-limite-de-intentos-y-nueva-vista.md`), decisiones aprobadas por Mario.
> **Versión:** 2. Mismas decisiones que `login-con-validaciones-limite-de-intentos-y-nueva-vista.md`, con tareas más chicas para repartir entre agentes en paralelo.

## Objetivo

Que el inicio de sesión valide bien los datos en el frontend y en el backend, encuentre las cuentas sin importar mayúsculas, limite los intentos por IP y correo, y tenga una vista accesible con la identidad del Grupo.

## Contexto

Cómo está hoy el código (revisado el 2026-11-04). Ojo: el módulo de usuarios vive en `backend/src/users/`, no en `usuarios/` como dice CLAUDE.md.

**Frontend**

- `frontend/src/app/features/auth/login/login.component.ts` usa `email` y `password` con `[(ngModel)]`, sin `<form>`. Solo revisa que no estén vacíos. Si hay error, muestra en un **toast** (`MessageService`) el texto del backend (`err?.error?.message`). Después de entrar, navega a `/mi-comunidad` o `/calendario` si el rol es `scout`, y a `/` en los demás casos. Esa navegación se conserva.
- `login.component.html`:
  - Tiene el emoji `⚜️` como logo y `<div>` en lugar de `<main>`/`<section>`.
  - Los inputs van dentro de `p-input-icon-left` y usan `(keyup.enter)`. No tienen `autocomplete` ni botón para ver la contraseña.
  - El botón es `pButton` con `(click)`.
- `login.component.scss`:
  - El botón está fijo en azul `#2563EB` / `#1d4ed8` con `!important`.
  - El fondo es un degradado marino (`#0d1b33` → `#1B2A4A`).
  - La tarjeta usa `var(--surface-card)`.
- `frontend/src/app/features/auth/auth.module.ts` importa `FormsModule`, `InputTextModule`, `ButtonModule` y `PasswordModule`, pero **no** `ReactiveFormsModule`. Otros formularios del repo ya usan `FormBuilder`: `crear-solicitud`, `registro-caminante`, `crear-informe` y `crear-ciclo`.
- `AuthInterceptor` (`core/interceptors/auth.interceptor.ts`) llama a `logout()` en cada 401 y **relanza** el error (`throwError`). En el login, el componente recibe el 401 igual, así que **no se cambia**.
- `app.component.html`:
  - Envuelve el `router-outlet` en un `<div>`, no en un `<main>`.
  - Tiene un `<p-toast>` global que se queda para el resto de la app.
- `ThemeService` pone en `<body>` la clase `p-theme-aura-dark-blue` o `p-theme-aura-light-blue`. Define `--surface-card`, `--text-color`, `--text-color-secondary` y `--surface-border` para los dos temas.
- `frontend/src/assets/images/logo-grupo.png` mide 300×300 y pesa 195 KB. Lo usan `core/services/seccion.service.ts:26` y `config-secciones.component.ts:48`, así que **no se reemplaza**: se agrega una copia reducida.
- `/api` está en el mismo origen que el frontend: en producción por `frontend/nginx.conf` y en desarrollo por `frontend/proxy.conf.json`. Por eso el navegador puede leer `Retry-After` aunque CORS no exponga la cabecera.

**Backend**

- `backend/src/auth/dto/login.dto.ts` solo tiene `@IsEmail`, `@IsNotEmpty` e `@IsString`, sin mensajes. `auth.service.ts` ya responde `'Credenciales inválidas'` tanto si la contraseña está mal como si el usuario está inactivo.
- `UsersService.findByEmail` (`backend/src/users/users.service.ts:20`) busca el correo exacto con `findOne({ where: { email } })`. Lo usan:
  - `auth.service.ts`.
  - `create`, para ver si el correo ya existe.
  - `update`, en las líneas 40-41.
  - `seedUsers` (línea 83), que corre **al arrancar** desde `main.ts`.
- `update` compara `data.email !== user.email` y guarda con `usersRepository.update(...)`, que **no** ejecuta hooks `@BeforeUpdate`.
- `caminantes.service.ts:79-96` crea el usuario de un joven con `userRepo.create` y `save`, sin pasar por `UsersService`. El correo llega de `create-caminante.dto.ts:39` y es opcional; si falta, se genera uno `@scouts.local`.
- La columna `email` de `backend/src/users/entities/user.entity.ts` es `@Column({ length: 200, unique: true })`. Esa restricción `unique` distingue mayúsculas.
- `main.ts`:
  - Crea la app con `NestFactory.create(AppModule)`, sin tipo.
  - Tiene un `ValidationPipe` global con `whitelist` y `transform`, y CORS `origin: '*'`.
  - No configura `trust proxy`.
- `@nestjs/throttler` no está instalado. `@nestjs/core` y `@nestjs/common` están en la versión 10.4.22, y `@nestjs/throttler@^6` los acepta como peer.
- `@Transform` de `class-transformer` ya se usa en `evidencias/dto/create-evidencia.dto.ts`.
- `.env.example` existe en la raíz. `specs/.spec-config.yml` también existe, con `AutoCreateBranch: true`.

**Otros clientes del login**

- `mcp-server/src/api.ts` guarda el token en memoria y solo vuelve a iniciar sesión si no tiene token o si recibe un 401. Si el login falla, hoy lanza `Login fallido (<status>): revisa SCOUTS_EMAIL / SCOUTS_PASSWORD.` (línea 27), y eso confunde cuando el error es un 429.
- El bot de Telegram corre dentro del backend y no llama al login.

**Despliegue**

- Producción está en la Raspberry (`raspberrypi.local`), cuya BD es la fuente de verdad. También se entra desde internet por `https://scouts.itsitarhiata.com`, a través de Cloudflare.
- No se sabe si `cloudflared` corre en el Pi, así que tampoco cuántos proxies hay delante del backend.
- `nginx` manda `X-Real-IP` y `X-Forwarded-For` (`$proxy_add_x_forwarded_for`).
- El repo no tiene Jest ni Karma: no hay script `test` ni archivos `*.spec.ts`.

**Identidad visual**

- Marino `#14265C`, oro `#EFC02F` y oro oscuro `#B8891A` (los de `informes.service.ts`).
- El marino sobre oro tiene un contraste de ≈ 8:1. El blanco sobre oro no llega a 4.5:1.

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

### Precisiones de implementación (salen del código; no cambian las decisiones)

- **"En minúsculas" (decisión 1):** el correo se **normaliza** con trim y minúsculas al salir del campo y antes de enviar. No se muestra un error por escribir mayúsculas. El campo correo tiene tres errores posibles: vacío, formato inválido y espacios en medio.
- **Duplicados (decisión 3):** si `findByEmail` encuentra más de una cuenta, registra un `warn` y **lanza** `CorreoDuplicadoError`. Cada llamador lo trata así:
  - `auth.service` lo convierte en el 401 genérico.
  - `create` y `update` responden 409.
  - `seedUsers` lo captura, lo registra y sigue con la siguiente cuenta, para que el backend no se caiga al arrancar.

  No devuelve `null` porque entonces `create` dejaría registrar una tercera cuenta.
- **Saltos de proxy (decisión 7):** se leen de la variable `TRUST_PROXY_HOPS`. Por defecto vale `1`, que es solo nginx. El valor real se fija en el `.env` del Pi sin reconstruir la imagen. El log temporal solo se activa con `LOG_IP_LOGIN=1` y va marcado con `// TEMPORAL`.
- **Intentos (decisión 6):** se cuentan todos, también los que entran bien. La clave del throttler normaliza `req.body.email` por su cuenta, porque el guard corre **antes** del `ValidationPipe`.
- **Lógica pura aparte (decisiones 1, 9 y 10):** los textos, el mapeo de status a mensaje, la lectura de `Retry-After` y el validador de espacios van en un archivo propio, `login-errores.ts`, sin dependencias de runtime. Así el componente solo maneja el estado y se puede probar con `node`.

## Criterios de aceptación

**Backend**

- [ ] `POST /api/auth/login` con `"  Mario@Scouts.MX "` y la contraseña correcta devuelve 200 para la cuenta `mario@scouts.mx`.
- [ ] Una cuenta guardada con mayúsculas antes de este cambio (por ejemplo `Prueba@X.com`) entra escribiendo `prueba@x.com`.
- [ ] Una contraseña mala y un usuario inactivo devuelven 401 con el mismo cuerpo (`"Credenciales inválidas"`).
- [ ] Si dos cuentas solo se distinguen por mayúsculas, las dos reciben 401 y el log del backend tiene una línea `warn` con el correo en minúsculas (sin contraseñas ni hashes).
- [ ] El backend arranca aunque existan esas cuentas duplicadas: `seedUsers` registra el problema y sigue.
- [ ] Un correo de más de 254 caracteres o una contraseña de más de 128 devuelven 400 con mensajes en español.
- [ ] Al crear o editar un usuario (`/api/users`) o dar de alta un joven con un correo con mayúsculas o espacios, el correo se guarda con trim y en minúsculas.
- [ ] Crear un usuario con `JUAN@x.com` cuando ya existe `juan@x.com` devuelve 409.
- [ ] Editar el propio correo cambiando solo las mayúsculas no devuelve "ya existe".
- [ ] `backend/src/caminantes/dto/tutores.dto.ts` no cambia.
- [ ] El 6.º intento en menos de un minuto con la misma IP y el mismo correo devuelve 429, con `"Demasiados intentos, espera un momento"` y la cabecera `Retry-After` en segundos. La cabecera se llama exactamente así, sin sufijo.
- [ ] Mientras un correo está bloqueado, otro correo desde la misma IP puede seguir intentando.
- [ ] Las demás rutas de `/api` no tienen límite de intentos.
- [ ] `trust proxy` usa `TRUST_PROXY_HOPS`, y en el Pi está fijado al número de saltos medido.
- [ ] El log temporal de IP ya no está en el código ni activo en el Pi.
- [ ] Si el MCP recibe un 429 en el login, muestra que hay demasiados intentos y cuántos segundos esperar, no "revisa SCOUTS_EMAIL / SCOUTS_PASSWORD".
- [ ] `cd backend && npm run build` y `cd mcp-server && npm run build` terminan sin errores.

**Frontend**

- [ ] El login es un `<form>` con `formGroup`. Enter envía el formulario y no queda ningún `(keyup.enter)`.
- [ ] Los errores aparecen debajo de su campo al salir de él o al intentar enviar, enlazados con `aria-describedby` y marcados con `aria-invalid`. No se usa toast.
- [ ] Al salir del campo correo, su valor queda con trim y en minúsculas.
- [ ] La contraseña no tiene longitud mínima.
- [ ] Mientras carga, el botón está deshabilitado y no se puede enviar dos veces.
- [ ] Un 401 o un 400 muestran "Correo o contraseña incorrectos".
- [ ] Un error de red (status 0), un 5xx o cualquier otro status inesperado muestran "No pudimos conectar con el servidor, revisa tu conexión".
- [ ] Nunca se muestra el texto que manda el backend: `err.error.message` no aparece en el código del login.
- [ ] Ante un 429, el botón deshabilitado cuenta los segundos de `Retry-After` (60 si no llega) y los campos siguen editables.
- [ ] El lector de pantalla solo anuncia la espera al empezar y al terminar.
- [ ] El botón principal es oro `#EFC02F` con texto marino `#14265C`. `#2563EB` ya no aparece en `login.component.scss`.
- [ ] Se ve el logo `logo-grupo-160.png` (160×160, menos de 40 KB) con `width`, `height` y `alt="Grupo Scout 7 Itsï Tarhiata"`, sin salto de diseño al cargar.
- [ ] El botón para ver u ocultar la contraseña es `type="button"`, tiene `aria-label` y `aria-pressed`, y se puede usar con teclado.
- [ ] El correo tiene `autocomplete="email"` e `inputmode="email"`, y la contraseña `autocomplete="current-password"`.
- [ ] La vista se ve y se lee bien en tema claro y oscuro, a 375, 768 y 1280 px de ancho. No hay scroll horizontal, las áreas táctiles miden al menos 44 px y el foco se ve en los dos temas.
- [ ] `cd frontend && npm run build` termina sin errores.

**Operación**

- [ ] Antes de desplegar se revisaron los duplicados por mayúsculas en la BD del Pi. El resultado está anotado en el PR y, si había duplicados, se resolvieron.
- [ ] Se borraron las cuentas de prueba de la BD local y no quedaron artefactos de prueba en el repo.

## Tareas

Orden sugerido: las tareas 1, 8, 9, 10, 11 y 14 arrancan de inmediato. La 1 desbloquea el backend y la 11 el componente. Las tareas 15, 16 y 17 son de verificación y despliegue y van al final.

### Tarea 1: Dependencia del throttler y helper para normalizar correos

Agente: OpenCode

**Qué hacer**

- En `backend/`, ejecutar `npm install @nestjs/throttler@^6`. La 6.x acepta `@nestjs/common` 10 como peer.
- Después de instalar, anotar en el PR dos datos de la versión instalada (los usan las Tareas 6 y 7):
  - La firma real de `getTracker`, que está en `node_modules/@nestjs/throttler/dist/throttler.guard.d.ts`.
  - Los nombres de las opciones de `forRoot` (`throttlers`, `errorMessage`), que están en `throttler-module-options.interface.d.ts`.
- Crear `backend/src/common/normalizar-correo.ts` con:
  - `export function normalizarCorreo<T>(valor: T): T`: si `valor` es string, devuelve `valor.trim().toLowerCase()`. Si no, lo devuelve tal cual (`undefined` y `null` pasan sin cambios).
  - `export const NormalizarCorreo = () => Transform(({ value }) => normalizarCorreo(value));`, con `Transform` importado de `class-transformer`.
  - Un comentario de una línea que diga que la regla vive solo en este archivo.
- Ninguna otra tarea toca `package.json` ni `package-lock.json`.

**Archivos:** `backend/package.json`, `backend/package-lock.json`, `backend/src/common/normalizar-correo.ts` (nuevo).

**Verificación**

- `cd backend && npm ls @nestjs/throttler` muestra la versión instalada sin errores de peer.
- `npm run build` compila.
- `npx ts-node -e "import {normalizarCorreo} from './src/common/normalizar-correo'; console.log(JSON.stringify([normalizarCorreo('  A@B.Com '), normalizarCorreo(undefined) === undefined, normalizarCorreo(null)]))"` imprime `["a@b.com",true,null]`.

### Tarea 2: Validaciones de `LoginDto`

Agente: OpenCode
Depende de: Tarea 1

**Qué hacer:** en `backend/src/auth/dto/login.dto.ts` (seguir bros-back-validacion):

- `email`, en este orden:
  - `@NormalizarCorreo()`.
  - `@IsEmail({}, { message: 'El correo no tiene un formato válido' })`.
  - `@MaxLength(254, { message: 'El correo no puede tener más de 254 caracteres' })`.
- `password`:
  - `@IsString({ message: 'La contraseña debe ser texto' })`.
  - `@IsNotEmpty({ message: 'Escribe tu contraseña' })`.
  - `@MaxLength(128, { message: 'La contraseña no puede tener más de 128 caracteres' })`.
- **No** agregar `MinLength`.

**Archivos:** `backend/src/auth/dto/login.dto.ts`.

**Verificación** (backend local en marcha)

- `npm run build` compila.
- `curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$(printf 'a%.0s' {1..250})@x.com\",\"password\":\"x\"}"` devuelve 400 con el mensaje de 254 caracteres.
- Una contraseña de 129 caracteres devuelve 400 con el mensaje de 128.
- `{"email":"  A@B.COM ","password":"x"}` **no** da 400: da 401.

### Tarea 3: Transformer en la columna `email` de `User`

Agente: OpenCode
Depende de: Tarea 1

**Qué hacer:** en `backend/src/users/entities/user.entity.ts`, cambiar la columna a

```ts
@Column({ length: 200, unique: true, transformer: { to: normalizarCorreo, from: (v: string) => v } })
email: string;
```

y agregar el import `normalizarCorreo` de `../../common/normalizar-correo`.

- El esquema no cambia: no se agregan ni se quitan columnas. Esto importa porque producción usa `synchronize: true`.
- Sin migración.

**Archivos:** `backend/src/users/entities/user.entity.ts`.

**Verificación**

- `npm run build` compila.
- Con el backend local en marcha, el log de arranque no muestra ningún `ALTER TABLE` sobre `users`.
- Con la cuenta admin, crear por `POST /api/users` un usuario con `"  Temp.Prueba@X.com "`. Revisar con `psql` que quedó `temp.prueba@x.com`.
- Editar ese mismo usuario por `PATCH /api/users/:id` con `"email": " Otro.Prueba@X.com "` y revisar con `psql` que quedó `otro.prueba@x.com`. Esto comprueba que el transformer se aplica también en `repository.update()`, que es la premisa de la decisión 4. En esta rama todavía no está el `@Transform` de la Tarea 4, así que lo que se prueba es solo el transformer.
- Borrar el usuario de prueba.

### Tarea 4: `@NormalizarCorreo()` en los DTOs que crean o editan cuentas

Agente: OpenCode
Depende de: Tarea 1

**Qué hacer:** poner `@NormalizarCorreo()` en el campo `email`, encima de `@IsEmail()`, en estos tres DTOs:

- `create-user.dto.ts`.
- `update-user.dto.ts`.
- `create-caminante.dto.ts`. Aquí el correo es opcional, pero el helper deja pasar `undefined`.

**No** tocar `backend/src/caminantes/dto/tutores.dto.ts`.

**Archivos:** `backend/src/users/dto/create-user.dto.ts`, `backend/src/users/dto/update-user.dto.ts`, `backend/src/caminantes/dto/create-caminante.dto.ts`.

**Verificación**

- `npm run build` compila.
- `git diff --stat` no muestra cambios en `tutores.dto.ts`.
- En la BD local, dar de alta un joven de prueba con `"Joven.Prueba@X.com"` y revisar en `users` que quedó en minúsculas.
- Dar de alta otro joven sin correo y comprobar que sigue generando el `@scouts.local`.
- Borrar los dos jóvenes y sus usuarios.

### Tarea 5: `findByEmail` sin distinguir mayúsculas y manejo de duplicados

Agente: Claude
Depende de: Tarea 1

**Qué hacer** (seguir bros-back-seguridad y bros-back-datos):

- En `users.service.ts`, crear y exportar `class CorreoDuplicadoError extends Error`, que guarde el correo normalizado.
- Reescribir `findByEmail(email)`:
  - Normalizar con `normalizarCorreo`.
  - Buscar con `createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).take(2).getMany()`.
  - Con 0 resultados devuelve `null` y con 1 devuelve el usuario.
  - Con 2 o más, registra con `Logger.warn` el texto "Hay cuentas cuyo correo solo difiere en mayúsculas: <correo>; resuélvelo a mano" y lanza `CorreoDuplicadoError`.
- `create`: si `findByEmail` encuentra un usuario o lanza `CorreoDuplicadoError`, responde `ConflictException('El correo ya está registrado')`.
- `update`:
  - Comparar los correos ya normalizados.
  - Decir "ya existe" solo si el usuario encontrado tiene **otro** `id`.
  - `CorreoDuplicadoError` también da 409.
- `seedUsers`: envolver cada cuenta en un `try/catch` de `CorreoDuplicadoError`. Si ocurre, registrarlo y seguir con la siguiente cuenta, para que el backend no muera al arrancar.
- `auth.service.ts`:
  - Si `findByEmail` lanza `CorreoDuplicadoError`, responder `UnauthorizedException('Credenciales inválidas')`, con el mismo cuerpo que una contraseña mala.
  - El 401 genérico para el usuario inactivo se queda igual.
- Nunca registrar contraseñas ni hashes.

**Archivos:** `backend/src/users/users.service.ts`, `backend/src/auth/auth.service.ts`.

**Verificación** (en la BD local, nunca en la del Pi)

- `npm run build` compila.
- Insertar con SQL directo una cuenta `Prueba.Mayus@X.com`, con el hash bcrypt de una contraseña conocida. Entrar con `prueba.mayus@x.com` → 200.
- Insertar `prueba.mayus@x.com` como segunda cuenta y comprobar:
  - Las dos variantes del correo dan 401 `Credenciales inválidas`.
  - El log muestra el `warn`.
  - Al reiniciar, el backend arranca bien.
- `POST /api/users` con `PRUEBA.MAYUS@x.com` → 409.
- Editar una cuenta cambiando solo las mayúsculas de su propio correo → 200.
- Borrar las cuentas de prueba y confirmar con un `SELECT` que no quedó ninguna.

### Tarea 6: Guard del límite de intentos (clave IP + correo)

Agente: Claude
Depende de: Tarea 1

**Qué hacer** (seguir bros-back-seguridad): crear `backend/src/auth/guards/login-throttler.guard.ts` con `@Injectable() export class LoginThrottlerGuard extends ThrottlerGuard`.

- Sobrescribir `getTracker` con la firma de la versión instalada (anotada en la Tarea 1). Debe devolver `` `${req.ip}|${correo}` ``.
- `correo` es `normalizarCorreo(req.body?.email)`, recortado a 254 caracteres, y solo si `req.body.email` es string. Cualquier otro valor cuenta como `''`.
- El correo se normaliza aquí porque el guard corre **antes** del `ValidationPipe`.
- No leer `CF-Connecting-IP`, `X-Forwarded-For` ni ninguna otra cabecera: la IP sale solo de `req.ip`, que ya respeta `trust proxy`.
- Sin excepciones por IP, por cabecera ni por usuario.
- En esta tarea no se cablea el guard: solo se crea el archivo.

**Archivos:** `backend/src/auth/guards/login-throttler.guard.ts` (nuevo).

**Verificación**

- `npm run build` compila.
- Ejecutar:

  ```bash
  npx ts-node -e "import {LoginThrottlerGuard} from './src/auth/guards/login-throttler.guard'; const g=(LoginThrottlerGuard.prototype as any).getTracker; Promise.all([g.call({}, {ip:'1.2.3.4', body:{email:' A@B.COM '}}), g.call({}, {ip:'1.2.3.4', body:{email:42}}), g.call({}, {ip:'1.2.3.4'})]).then(r=>console.log(JSON.stringify(r)))"
  ```

  Debe imprimir `["1.2.3.4|a@b.com","1.2.3.4|","1.2.3.4|"]`.

### Tarea 7: Aplicar el límite de intentos solo a `POST /api/auth/login`

Agente: OpenCode
Depende de: Tarea 6

**Qué hacer**

- En `backend/src/auth/auth.module.ts`, agregar a `imports`:

  ```ts
  ThrottlerModule.forRoot({
    throttlers: [{ ttl: 60_000, limit: 5 }],
    errorMessage: 'Demasiados intentos, espera un momento',
  }),
  ```

- Tres reglas que no se pueden saltar:
  - El throttler va **sin** `name`. Con un nombre propio, la cabecera saldría como `Retry-After-<nombre>` y el frontend no la leería.
  - `ttl` va en **milisegundos**.
  - **No** registrar `APP_GUARD`, para que el resto de la API no quede limitado.
- Si los nombres de las opciones no coinciden con la versión instalada (ver la nota de la Tarea 1), ajustarlos sin cambiar los valores.
- Registrar `LoginThrottlerGuard` en `providers`.
- En `backend/src/auth/auth.controller.ts`, poner `@UseGuards(LoginThrottlerGuard)` **solo** en el método `login`.
- El almacenamiento es en memoria, el que trae el throttler por defecto.

**Archivos:** `backend/src/auth/auth.module.ts`, `backend/src/auth/auth.controller.ts`.

**Verificación** (backend local)

- `npm run build` compila.
- `for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"nadie@x.com","password":"mala"}'; done` imprime cinco `401` y un `429`.
- `curl -si` del 7.º intento muestra `Retry-After: <segundos>` (sin sufijo) y un cuerpo con `"Demasiados intentos, espera un momento"`.
- En el mismo minuto, `{"email":"otro@x.com",...}` devuelve 401, no 429.
- `{"email":" NADIE@X.COM ",...}` devuelve 429, porque cuenta como el mismo correo.
- `GET /api/dashboard` con token, repetido 10 veces, nunca devuelve 429.

### Tarea 8: `trust proxy` configurable y log temporal de IP

Agente: OpenCode

**Qué hacer**

En `backend/src/main.ts`:

- Crear la app con `NestFactory.create<NestExpressApplication>(AppModule)`, importando `NestExpressApplication` de `@nestjs/platform-express`.
- Justo después de crearla:

```ts
const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
app.set('trust proxy', Number.isFinite(hops) && hops >= 0 ? hops : 1);

// TEMPORAL (spec login): averiguar cuántos proxies hay delante. Se quita en la Tarea 17.
if (process.env.LOG_IP_LOGIN === '1') {
  app.use('/api/auth/login', (req, _res, next) => {
    console.log('[TEMPORAL ip-login]', JSON.stringify({ ip: req.ip, ips: req.ips, xff: req.headers['x-forwarded-for'], cf: req.headers['cf-connecting-ip'] }));
    next();
  });
}
```

- No usar `CF-Connecting-IP` para nada más.

En `.env.example`, agregar con un comentario:

- `TRUST_PROXY_HOPS=1`: número de proxies delante del backend. `1` es solo nginx.
- `# LOG_IP_LOGIN=1`: solo para diagnóstico temporal.

**Archivos:** `backend/src/main.ts`, `.env.example`.

**Verificación**

- `npm run build` compila.
- Levantar el backend local con `LOG_IP_LOGIN=1` y hacer un login con `curl -H 'X-Forwarded-For: 9.9.9.9'`:
  - Con `TRUST_PROXY_HOPS=1`, el log muestra `ip: "9.9.9.9"`.
  - Con `TRUST_PROXY_HOPS=0`, muestra `::1` o `127.0.0.1`.
- Sin `LOG_IP_LOGIN` no se imprime nada.

### Tarea 9: El MCP explica un 429 al iniciar sesión

Agente: OpenCode

**Qué hacer:** en `mcp-server/src/api.ts`, dentro de `login()`, justo antes del `if (!res.ok) throw ...` de la línea 27:

```ts
if (res.status === 429) {
  const espera = res.headers.get('retry-after') ?? '60';
  throw new Error(`Demasiados intentos de inicio de sesión en la app. Espera ${espera} segundos y vuelve a intentarlo.`);
}
```

- El mensaje actual (`revisa SCOUTS_EMAIL / SCOUTS_PASSWORD`) se queda para los demás códigos.
- No se cambia nada más: ni cómo se guarda el token ni los reintentos.

**Archivos:** `mcp-server/src/api.ts`.

**Verificación** (no necesita el backend)

- `cd mcp-server && npm run build` compila.
- En una terminal, levantar un servidor falso: `node -e "require('http').createServer((q,s)=>{s.writeHead(429,{'Retry-After':'42'});s.end()}).listen(3999)"`.
- En otra, ejecutar `SCOUTS_API_URL=http://localhost:3999 SCOUTS_EMAIL=x@x.com SCOUTS_PASSWORD=x node -e "require('./dist/api').usuarioActual().catch(e=>console.log(e.message))"`. Debe imprimir el mensaje con `42 segundos`.
  - Si `usuarioActual` no se exporta con ese nombre, usar cualquier función exportada que llame a `login()`.
- Cambiar el servidor falso a `writeHead(401)` y comprobar que sale el mensaje de siempre.
- Detener el servidor falso.

### Tarea 10: Logo reducido del Grupo para el login

Agente: OpenCode

**Qué hacer**

- Generar el logo reducido: `sips -Z 160 frontend/src/assets/images/logo-grupo.png --out frontend/src/assets/images/logo-grupo-160.png`.
- Si pesa 40 KB o más, comprimirlo con `pngquant` conservando la transparencia:
  - Instalarlo con `brew install pngquant`.
  - Ejecutar `pngquant --force --output <archivo> --quality 70-90 <archivo>`.
- **No** modificar ni borrar `logo-grupo.png`, porque lo usan `seccion.service.ts` y `config-secciones`.

**Archivos:** `frontend/src/assets/images/logo-grupo-160.png` (nuevo).

**Verificación**

- `file frontend/src/assets/images/logo-grupo-160.png` dice `160 x 160` y `RGBA`.
- `ls -l` muestra menos de 40 KB.
- Al abrirlo se ve nítido y sin fondo blanco.
- `git status` solo muestra el archivo nuevo.

### Tarea 11: Textos y lógica pura del login (`login-errores.ts`)

Agente: OpenCode

**Qué hacer:** crear `frontend/src/app/features/auth/login/login-errores.ts`. Este archivo es el contrato con la Tarea 12. Lleva solo `import type` de `@angular/forms`, sin dependencias de runtime, y exporta exactamente esto:

```ts
export const TEXTOS = {
  correoVacio: 'Escribe tu correo',
  correoFormato: 'Revisa el correo, por ejemplo nombre@scouts.mx',
  correoEspacios: 'El correo no puede tener espacios',
  passwordVacia: 'Escribe tu contraseña',
  credenciales: 'Correo o contraseña incorrectos',
  sinConexion: 'No pudimos conectar con el servidor, revisa tu conexión',
  esperaFin: 'Ya puedes intentarlo de nuevo',
} as const;

/** 'Demasiados intentos. Espera N segundos e inténtalo de nuevo' */
export function textoEsperaInicio(segundos: number): string;

/** trim + minúsculas; si no es string devuelve '' */
export function normalizarCorreo(valor: unknown): string;

/** Validador: { espacios: true } si el valor, ya con trim, contiene algún espacio; si no, null */
export function sinEspaciosValidator(control: AbstractControl): ValidationErrors | null;

/** 400 y 401 → TEXTOS.credenciales; cualquier otro status (0, 403, 404, 5xx…) → TEXTOS.sinConexion. El 429 no pasa por aquí. */
export function mensajePorStatus(status: number): string;

/** Entero > 0 desde la cabecera Retry-After (en segundos); si falta, no es número o es ≤ 0 → porDefecto */
export function leerRetryAfter(valor: string | null, porDefecto = 60): number;
```

- `TEXTOS` y las funciones no se tocan después sin cambiar también la Tarea 12.
- Textos en español, con mayúscula solo al inicio (bros-front-estados).

**Archivos:** `frontend/src/app/features/auth/login/login-errores.ts` (nuevo).

**Verificación**

- `cd frontend && npx tsc --noEmit --strict --target es2020 --moduleResolution node src/app/features/auth/login/login-errores.ts` compila sin errores.
- Compilar a un directorio temporal fuera del repo con `npx tsc --outDir /tmp/login-errores --target es2020 --module commonjs src/app/features/auth/login/login-errores.ts`. Luego ejecutar con `node` estos casos y ver que salen como se espera:
  - `mensajePorStatus(401)`, `(400)`, `(0)`, `(500)` y `(403)`.
  - `leerRetryAfter('30')` → 30.
  - `leerRetryAfter(null)`, `('abc')`, `('0')` y `('-5')` → 60.
  - `normalizarCorreo('  A@B.Com ')` → `'a@b.com'`.
  - `sinEspaciosValidator({ value: 'a b@x.com' })` → `{ espacios: true }` (en `node` se pasa un objeto simple con `value`).
  - `sinEspaciosValidator({ value: ' a@x.com ' })` → `null`.
- Borrar `/tmp/login-errores` al terminar.

### Tarea 12: Formulario reactivo del login: componente, plantilla y módulo

Agente: Claude
Depende de: Tarea 11

**Qué hacer** (seguir bros-front-estados y bros-front-accesibilidad)

En `frontend/src/app/features/auth/auth.module.ts`:

- Agregar `ReactiveFormsModule`.
- Quitar `FormsModule` y `PasswordModule` si ya no se usan.

Reescribir `login.component.ts`:

- Usar todo lo de `login-errores.ts` (Tarea 11) y no repetir ninguno de sus textos.
- Quitar `MessageService` y los toasts.
- Conservar la navegación de después de entrar tal como está hoy.
- Exponer este contrato público para la plantilla:
  - `form`: se crea con `FormBuilder.nonNullable`.
    - `email`: `Validators.required`, `Validators.email` y `sinEspaciosValidator`.
    - `password`: solo `Validators.required`.
  - `loading: boolean`, `submitted: boolean` y `showPassword: boolean`.
  - `togglePassword(): void`.
  - `fieldError(campo: 'email' | 'password'): string | null`. Devuelve el texto del primer error (`TEXTOS`) si el control está `touched` o si `submitted` es `true`; si no, `null`.
    - Precedencia fija, sin depender del orden de las claves de `errors`. En el correo: `required` → `espacios` → `email`, porque `a b@x.com` falla a la vez `espacios` y `email` y debe salir el de espacios. En la contraseña: `required`.
  - `normalizarCorreo(): void`. Se llama en el `(blur)` del correo y aplica la normalización al valor.
  - `errorMsg: string | null`, que se ve en la tarjeta.
  - `liveMsg: string`, el texto de la región `aria-live`. Empieza como `''`.
  - `segundosEspera: number`.
  - `get bloqueado(): boolean`, que vale `loading || segundosEspera > 0`.
  - `onSubmit(): void`.
  - `year`, que se conserva.

**Reglas**

- `onSubmit`:
  1. Si `bloqueado`, no hace nada.
  2. Normaliza el correo y marca `submitted`.
  3. Si el formulario es inválido, mueve el foco al primer campo con error y no envía.
  4. Limpia `errorMsg`.
- Nunca leer `err.error.message`.
- Si el status no es 429, usar `mensajePorStatus(err.status)`. Poner el resultado en `errorMsg` y en `liveMsg`. Si el mensaje es igual al anterior, vaciar `liveMsg` y volver a asignarlo con `setTimeout(…, 0)`, para que el lector lo repita.
- Si el status es 429:
  - Calcular `segundosEspera = leerRetryAfter(err.headers?.get('Retry-After'))`.
  - Poner `errorMsg = liveMsg = textoEsperaInicio(n)`.
  - Bajar `segundosEspera` cada segundo con un intervalo. Al llegar a 0, limpiar el intervalo, poner `liveMsg = TEXTOS.esperaFin` y limpiar `errorMsg`.
  - `liveMsg` cambia **solo** al empezar y al terminar.
  - El intervalo también se limpia en `ngOnDestroy`.
- No se agregan dependencias.

Reescribir `login.component.html` usando solo el contrato de arriba. Las clases que se nombran aquí son el contrato con la Tarea 13.

**Estructura**

- `<main class="login-wrapper">`, que contiene `<section class="login-card" aria-labelledby="login-title">`.
- `<img src="assets/images/logo-grupo-160.png" width="160" height="160" alt="Grupo Scout 7 Itsï Tarhiata" class="login-logo">`, sin `loading="lazy"`.
- `<h1 id="login-title" class="login-title">` con el título actual.
- Subtítulo `<p class="login-subtitle">Scouts México</p>`. Si se quiere en mayúsculas, eso va por CSS.
- `<form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="login-form">`.

**Campo correo**

- `<label for="email">Correo electrónico</label>`.
- `<input id="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" formControlName="email" pInputText (blur)="normalizarCorreo()">`.
- `[attr.aria-invalid]="!!fieldError('email')"` y `[attr.aria-describedby]="fieldError('email') ? 'email-error' : null"`.
- Debajo, con `*ngIf`: `<small id="email-error" class="field-error"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> …</small>`.

**Campo contraseña**

- Igual que el correo, con `autocomplete="current-password"`, `[type]="showPassword ? 'text' : 'password'"` e `id="password-error"`.
- Dentro de `<div class="password-wrap">`, al lado del input: `<button type="button" class="toggle-password" (click)="togglePassword()" [attr.aria-pressed]="showPassword" [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'">`, con el ícono `pi pi-eye` o `pi pi-eye-slash` y `aria-hidden="true"`.

**Mensajes y botón**

- `<p class="server-error">{{ errorMsg }}</p>`:
  - Siempre está en el DOM: sin `*ngIf` y sin `role="alert"`.
  - Es solo visual.
- `<div class="sr-only" aria-live="polite" aria-atomic="true">{{ liveMsg }}</div>`:
  - Siempre está en el DOM.
  - Es lo único que se anuncia.
- Botón: `<button type="submit" class="login-btn" [disabled]="bloqueado">`. Su texto depende del estado:
  - `Iniciar sesión` normalmente.
  - `Entrando…` mientras carga.
  - `Espera {{ segundosEspera }} s` durante la espera, sin `aria-live`.
- Los campos **no** se deshabilitan durante la espera.
- Se mantiene el pie con el año.
- El logo lo agrega la Tarea 10. Si todavía no está integrada, en esta rama la imagen sale rota, pero el build no falla.

**Archivos:** `frontend/src/app/features/auth/login/login.component.ts`, `frontend/src/app/features/auth/login/login.component.html`, `frontend/src/app/features/auth/auth.module.ts`.

**Verificación**

- `cd frontend && npm run build` compila.
- `grep -nE "error\.message|ngModel|MessageService|keyup\.enter" frontend/src/app/features/auth/login/*` no encuentra nada.
- `grep -n "'Correo o contraseña" frontend/src/app/features/auth/login/login.component.*` no encuentra nada: los textos vienen de `TEXTOS`.
- Con `npm start` y el backend local:
  - Tab recorre correo → contraseña → ojo → botón.
  - Enter en cualquier campo envía.
  - El ojo cambia `aria-pressed` y el tipo del campo.
  - Enviar vacío muestra los dos errores y pone el foco en el correo.
  - Con una contraseña mala sale el mensaje en la tarjeta, y la región `aria-live` del DOM tiene el mismo texto.
  - Un login correcto navega igual que antes.

### Tarea 13: Estilos del login con la identidad

Agente: OpenCode
Depende de: Tarea 10, Tarea 12

**Qué hacer:** reescribir `login.component.scss` (seguir bros-front-diseno y bros-front-rendimiento).

**Colores y fondo**

- Variables SCSS al inicio: `$marino: #14265C`, `$oro: #EFC02F` y `$oro-osc: #B8891A`.
- `.login-wrapper`:
  - Fondo marino, sólido o con un degradado sutil de marinos (`#0d1b33` → `$marino`), en los dos temas.
  - `min-height: 100dvh`, con `100vh` como respaldo.
- `.login-card` usa `var(--surface-card)`, `var(--text-color)` y `var(--surface-border)`, para que siga el tema.
  - Un solo radio y una sombra discreta.
  - Sin animaciones de entrada.

**Logo**

- `.login-logo`: `width: 7.5rem; height: auto; display: block; margin: 0 auto`.

**Botón principal**

- `.login-btn`:
  - Fondo `$oro`, texto `$marino` con `font-weight: 700` y borde `$oro`.
  - Al pasar el mouse, `$oro-osc`.
  - Deshabilitado: `opacity: .6` y `cursor: not-allowed`.
  - Alto mínimo de 44 px y ancho completo.
- Quitar todo `#2563EB` y `#1d4ed8`. Usar `!important` solo si PrimeNG lo exige, con un comentario que diga por qué.

**Errores y contraseña**

- `.field-error` y `.server-error`:
  - Color de error con contraste de al menos 4.5:1 en los dos temas: `#b91c1c` en el claro y `#fca5a5` en el oscuro.
  - El ícono ya viene en la plantilla.
- `.server-error` reserva su alto con `min-height`, para que no haya saltos (CLS).
- `.password-wrap` con `position: relative`.
- `.toggle-password`:
  - Área de al menos 44×44 px, sin fondo.
  - Dentro del campo, a la derecha.
  - El input deja `padding-right` para que el texto no quede debajo del botón.

**Foco y accesibilidad**

- `:focus-visible` con `outline: 3px solid $oro; outline-offset: 2px` en el tema oscuro.
- En el tema claro, `:host-context(body.p-theme-aura-light-blue)` cambia el contorno a `$marino`, porque el oro sobre blanco no llega a 3:1.
- Clase `.sr-only`, visualmente oculta pero legible para el lector de pantalla.
- `@media (prefers-reduced-motion: reduce)` quita las transiciones.

**Celular**

- Por debajo de 400 px baja el padding de la tarjeta y no hay scroll horizontal.

**Archivos:** `frontend/src/app/features/auth/login/login.component.scss`.

**Verificación**

- `npm run build` compila sin avisos nuevos de presupuesto de estilos.
- `grep -niE "2563EB|1d4ed8" frontend/src/app/features/auth/login/login.component.scss` no encuentra nada.
- En el navegador:
  - Revisar 375, 768 y 1280 px en el tema oscuro y en el claro. Para ver el claro, alternar el tema dentro de la app y luego cerrar sesión.
  - El foco se ve en los cuatro controles en los dos temas.
  - Medir con DevTools el contraste del botón (marino sobre oro) y de los errores.

### Tarea 14: Revisar duplicados por mayúsculas en la BD del Pi

Agente: Claude

**Qué hacer** (seguir bros-back-datos): solo lectura, sin cambiar datos. Desde la Mac, en la red de casa:

```bash
ssh rasp@raspberrypi.local "cd /home/rasp/scouts-app && docker compose -f docker-compose.prod.yml exec -T postgres psql -U \$DB_USER -d \$DB_NAME -c \"SELECT LOWER(TRIM(email)) AS correo, COUNT(*), array_agg(id ORDER BY id) AS ids, array_agg(activo ORDER BY id) AS activos FROM users GROUP BY 1 HAVING COUNT(*) > 1;\""
```

- Si las variables no existen en la sesión remota, tomar el usuario y la base del `.env` del Pi sin imprimir la contraseña.
- Contar también los correos con mayúsculas o espacios: `SELECT COUNT(*) FROM users WHERE email <> LOWER(TRIM(email));`.
- Si hay duplicados, **no** resolverlos por cuenta propia. Anotar los ids, si están activos y a quién corresponden, y pedirle a Mario que decida cuál se queda.

**Archivos:** ninguno del repo. El resultado se anota en la descripción del PR de la spec.

**Verificación**

- La salida de las dos consultas está en el PR, sin datos sensibles más allá de ids y correos.
- Si hubo duplicados, Mario confirmó por escrito cómo se resolvieron antes de la Tarea 17.

### Tarea 15: Verificación manual del backend y limpieza

Agente: OpenCode
Depende de: Tarea 2, Tarea 3, Tarea 4, Tarea 5, Tarea 7, Tarea 8

**Qué hacer:** con todo integrado y el backend local en marcha (**BD local, nunca la del Pi**), recorrer esta lista y anotar en el PR el resultado de cada punto (✅/❌ y la salida relevante). Esperar 60 s entre bloques para no chocar con el límite de intentos.

1. Login de una cuenta de prueba creada para esto, escribiendo su correo con mayúsculas y espacios alrededor → 200.
2. Contraseña mala → 401 `Credenciales inválidas`.
3. Usuario de prueba inactivo (`activo=false`) → 401 con el mismo cuerpo que el punto 2.
4. Una cuenta guardada por SQL con mayúsculas (`Vieja.Mayus@X.com`) entra escribiendo el correo en minúsculas → 200.
5. Dos cuentas que solo se distinguen por mayúsculas → las dos dan 401 y aparece el `warn`. Reiniciar el backend y comprobar que arranca.
6. Correo de 255 caracteres o contraseña de 129 → 400 en español.
7. El bucle de 6 intentos de la Tarea 7 da cinco `401` y un `429`. `curl -si` muestra `Retry-After`. Otro correo desde la misma IP → 401.
8. Crear un usuario con `JUAN.PRUEBA@x.com` cuando ya existe `juan.prueba@x.com` → 409. Editar el propio correo cambiando solo las mayúsculas → 200.

**Limpieza** (memoria del proyecto): borrar con SQL todas las cuentas de prueba (ids anotados) y confirmar con un `SELECT` que no queda ninguna.

**Archivos:** ninguno del repo.

**Verificación:** la lista está en el PR con los 8 puntos en ✅, y el `SELECT` final no devuelve cuentas de prueba.

### Tarea 16: Verificación manual del frontend

Agente: OpenCode
Depende de: Tarea 7, Tarea 13

**Qué hacer:** con el frontend y el backend locales integrados (`npm start` en los dos), recorrer esta lista y anotar el resultado en el PR. Se pueden usar capturas con Playwright, guardadas fuera del repo.

1. **Validaciones:**
   - Enviar vacío muestra los dos errores.
   - `correo mal@x.com` muestra el error de espacios.
   - `nombre@` muestra el de formato.
   - Al salir del campo, `  Nombre@X.com ` queda como `nombre@x.com`.
   - Una contraseña de 1 carácter se acepta y se envía.
2. **Botón:** con *Network → Slow 3G* y doble clic se manda una sola petición, y el botón dice `Entrando…`.
3. **Errores del servidor:**
   - Un 401 muestra `Correo o contraseña incorrectos`.
   - Con el backend apagado sale `No pudimos conectar con el servidor, revisa tu conexión`.
   - No aparece ningún toast.
4. **429:**
   - Tras seis intentos malos, el botón dice `Espera N s`, cuenta hacia atrás y los campos siguen editables.
   - Al llegar a 0, el botón vuelve a `Iniciar sesión`.
   - En el DOM, la región `aria-live` cambia solo dos veces.
5. **Vista:**
   - El logo se ve nítido y no hay salto al cargar.
   - El botón es oro con texto marino.
   - Funciona en tema oscuro y en tema claro.
   - A 375, 768 y 1280 px no hay scroll horizontal.
6. **Teclado:** recorrer todo solo con Tab, Shift+Tab, Enter y Espacio. El foco se ve siempre.
7. **Lector de pantalla:** lo prueba **Mario con VoiceOver**. Dejarle en el PR estos pasos:
   1. Activar VoiceOver.
   2. Enviar el formulario vacío.
   3. Probar con una contraseña mala.
   4. Provocar el 429.

   Mario marca el resultado.
8. **Rendimiento:**
   - En *Network*, el logo pesa menos de 40 KB.
   - En `npm run build`, el chunk lazy de `auth` no crece más de unos pocos KB comparado con el build de la rama `main`.

**Limpieza:** no dejar capturas ni archivos de prueba en el repo. Si se crearon cuentas, borrarlas como en la Tarea 15.

**Archivos:** ninguno del repo.

**Verificación:** la lista completa está en el PR. Solo el punto 7 puede quedar pendiente, porque depende de Mario.

### Tarea 17: Despliegue, saltos reales de proxy y retiro del log temporal

Agente: Claude
Depende de: Tarea 9, Tarea 14, Tarea 15, Tarea 16

**Qué hacer** (seguir bros-back-seguridad y la memoria de despliegue):

1. Confirmar que la Tarea 14 no encontró duplicados o que ya se resolvieron.
2. Respaldar la BD del Pi con `pg_dump` en `backups/`.
3. Desplegar con push a `main`, como siempre (`deploy.yml`).
4. En el `.env` del Pi, poner temporalmente `LOG_IP_LOGIN=1` y reiniciar solo el backend.
5. Hacer un login desde internet (datos móviles, `https://scouts.itsitarhiata.com`) y otro desde la red local (`raspberrypi.local`).
6. Revisar `docker compose -f docker-compose.prod.yml logs backend | grep TEMPORAL`. Con `ips` y `xff`, contar cuántos proxies propios hay delante:
   - Solo nginx: 1 salto.
   - `cloudflared` (u otro) en el Pi, delante de nginx: 2 saltos.
7. Elegir el número de saltos que cumpla dos cosas:
   - En el acceso por internet, `req.ip` es la IP pública real del celular.
   - Desde la red local no se puede falsificar. Probarlo con `curl -H 'X-Forwarded-For: 1.2.3.4'` desde la LAN: `req.ip` **no** debe ser `1.2.3.4`.

   **Desempate:** si las dos condiciones piden números distintos, usar el **menor**, el que no se puede falsificar desde la red local (decisión 7: no confiar en cabeceras falsificables). En ese caso, anotar en el PR que los accesos por internet comparten IP en el contador. La clave IP + correo sigue evitando que una cuenta bloquee a otra.
8. Fijar `TRUST_PROXY_HOPS=<n>` en el `.env` del Pi y quitar `LOG_IP_LOGIN`.
9. En el repo:
   - Borrar de `backend/src/main.ts` el bloque `// TEMPORAL`.
   - Borrar de `.env.example` la línea `# LOG_IP_LOGIN`.
   - Ajustar el comentario de `TRUST_PROXY_HOPS` con lo encontrado, sin IPs.
10. Redesplegar. Al recrearse el contenedor desaparecen los logs con IPs.
11. En producción, hacer 6 intentos con `curl` y un correo inexistente (`nadie.prueba@x.com`): cinco `401` y un `429`.

Esta tarea y la 8 son las únicas que tocan `main.ts` y `.env.example`. No chocan porque esta va al final, cuando la Tarea 8 ya está integrada.

**Archivos:** `backend/src/main.ts`, `.env.example` (y el `.env` del Pi, que está fuera del repo).

**Verificación**

- `grep -rn "TEMPORAL\|LOG_IP_LOGIN" backend/src .env.example` no encuentra nada.
- En el Pi, `docker compose -f docker-compose.prod.yml logs backend | grep -c TEMPORAL` da 0.
- El 429 en producción está confirmado.
- El PR tiene anotado el número de saltos elegido y por qué, sin IPs reales.
