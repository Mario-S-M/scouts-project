# GrillMe No. 0002: Login con validaciones, límite de intentos y nueva vista

Fecha: 2026-11-04 · Rondas: 3

## Idea

Quiero que me ayudes a modificar el login por favor. Quiero que le pongas algunas validaciones y la parte de vista

## Decisiones aprobadas por Mario

- **Formulario reactivo con errores por campo** — El login pasa a Reactive Forms dentro de un <form> real. Correo obligatorio, con formato válido, sin espacios y en minúsculas; contraseña obligatoria y sin longitud mínima. Los errores salen debajo de cada campo al salir de él o al intentar enviar, y el botón se bloquea mientras carga.
  - Por qué: Es la convención del repo (FormBuilder en otros formularios). Las contraseñas las genera el admin al azar y una regla de fuerza al entrar podría dejar fuera a alguien; esas reglas van donde se crean contraseñas.
  - Confianza: alta
- **Validación del login en el backend** — `login.dto.ts` agrega @Transform (trim y minúsculas) en el correo, @MaxLength(254) en el correo y @MaxLength(128) en la contraseña, con mensajes en español. El 401 sigue siendo genérico ('Credenciales inválidas') para contraseña mala y para usuario inactivo.
  - Por qué: El backend no debe confiar solo en el frontend, y un mensaje genérico no revela qué correos existen.
  - Confianza: alta
- **Correos sin distinguir mayúsculas** — `findByEmail` (users.service.ts) busca con QueryBuilder y `LOWER(email) = LOWER(:email)`, lo que sirve para el login y para revisar si un correo ya existe. Si encuentra dos cuentas que solo se distinguen por mayúsculas, rechaza el login de ambas y lo registra en el log.
  - Por qué: Hoy la búsqueda es exacta y puede haber correos guardados con mayúsculas. Pasarlos a minúsculas sin esto dejaría fuera a esas personas.
  - Confianza: alta
- **Normalización del correo en un solo punto** — La columna `email` de la entidad User tiene un transformer que hace trim y minúsculas al escribir. Además, @Transform en create-user, update-user y create-caminante. El correo de tutores queda fuera porque no es una cuenta. No hay migración de los correos existentes.
  - Por qué: `caminantes.service` crea usuarios sin pasar por UsersService, y los hooks @BeforeUpdate no se ejecutan con `repository.update()`; el transformer cubre todas las rutas, incluido seedUsers.
  - Confianza: alta
- **Revisar duplicados antes de desplegar** — Antes de desplegar se corre en la BD del Pi una consulta de solo lectura para encontrar correos que solo se distinguen por mayúsculas, y se resuelven a mano si los hay.
  - Por qué: No se pudo confirmar si existen, y si los hay, esas cuentas quedarían bloqueadas.
  - Confianza: baja
- **Límite de intentos en el login** — Se agrega @nestjs/throttler (dependencia nueva), aplicado solo a POST /api/auth/login: 5 intentos por minuto contando por IP + correo normalizado, guardado en memoria. Responde 429 con el mensaje 'Demasiados intentos, espera un momento' y la cabecera Retry-After.
  - Por qué: El repo es público y la app se puede usar desde internet (Cloudflare). Contar por IP + correo evita que una reunión en el mismo Wi-Fi se bloquee entre sí.
  - Confianza: alta
- **IP real detrás de Cloudflare y nginx** — Se activa `trust proxy` con el número de saltos real, que se averigua en el Pi con un log temporal de la IP que ve el backend (y que se borra después). No se confía en CF-Connecting-IP sin más.
  - Por qué: No se pudo confirmar si cloudflared corre en el Pi. Con un salto de menos, todos los usuarios de internet contarían como la misma IP, y esa cabecera se puede falsificar desde la red local.
  - Confianza: baja
- **MCP y bot sin cambios** — El mcp-server ya guarda el token y solo vuelve a iniciar sesión ante un 401, y el bot de Telegram no usa el login, así que ninguno necesita excepción en el throttler. Lo único es que el MCP debe mostrar con claridad un 429 si llega a recibirlo.
  - Por qué: Una excepción por IP o por cabecera sería un hueco de seguridad en un repo público.
  - Confianza: media
- **Mensajes de error definidos por el frontend** — El frontend nunca muestra el texto del backend. 401 y 400 muestran 'Correo o contraseña incorrectos'; un error de red o un 5xx muestra 'No pudimos conectar con el servidor, revisa tu conexión'. Todo va en línea, con aria-live, en lugar del toast.
  - Por qué: Así no se filtran mensajes técnicos y los errores son accesibles para lectores de pantalla.
  - Confianza: alta
- **Espera tras demasiados intentos** — Ante un 429 se lee Retry-After (60 s si no llega), el botón muestra una cuenta regresiva deshabilitado y los campos siguen editables. aria-live solo anuncia al empezar y al terminar la espera, no cada segundo.
  - Por qué: La persona sabe cuánto esperar y el lector de pantalla no repite el número cada segundo.
  - Confianza: alta
- **Nueva vista con la identidad** — Se usan el marino #14265C y el oro #EFC02F en lugar del azul #2563EB fijo, con texto oscuro sobre el botón oro si hace falta por contraste. Se pone el logo del Grupo en versión reducida (unos 160 px, con width/height y alt) en lugar del emoji ⚜️. Se agrega un botón para mostrar u ocultar la contraseña (aria-label y aria-pressed) y autocomplete email/current-password. Debe funcionar en tema claro y oscuro y en el celular.
  - Por qué: El login es de todo el grupo, y el logo actual pesa 195 KB, lo que haría más lenta la primera carga. No hay una paleta del Grupo documentada; si Mario la tiene, se cambia después.
  - Confianza: media
- **Pruebas manuales y limpieza** — Solo se verifica a mano, con una lista escrita: correo con mayúsculas o espacios, contraseña mala, usuario inactivo, sexto intento → 429 con curl, validaciones y botón, temas, celular, teclado y lector de pantalla. Al terminar se borran las cuentas de prueba y los logs temporales.
  - Por qué: El repo no tiene Jest ni Karma configurados. Configurarlos es otra spec.
  - Confianza: alta
- **Fuera de alcance** — No incluye 'Olvidé mi contraseña', 'Recordarme', reglas de fuerza de contraseña ni configurar pruebas automáticas.
  - Por qué: Las contraseñas las administra el admin, y lo demás es trabajo aparte.
  - Confianza: alta

## Entrevista

### Ronda 1

1. 1) ¿Qué validaciones quieres exactamente y dónde? Recomiendo, en el frontend: pasar a Reactive Forms dentro de un <form> real; correo obligatorio y con formato válido, sin espacios y en minúsculas; contraseña obligatoria; errores debajo de cada campo (no en un toast), que salgan al salir del campo o al intentar enviar; botón bloqueado mientras carga para que no se envíe dos veces. En el backend, para que coincida: normalizar el correo (trim y minúsculas) en el DTO y poner un límite de longitud (correo ≤ 254, contraseña ≤ 128). ¿Te parece bien o tenías otras reglas en mente, por ejemplo una longitud mínima de contraseña?
2. 2) ¿Agregamos protección contra fuerza bruta, como limitar los intentos de login por IP (@nestjs/throttler, por ejemplo 5 intentos por minuto con el mensaje 'Demasiados intentos, espera un momento')? Recomiendo SÍ, porque el repo es público y la app está en internet desde la Raspberry. Si lo quieres, ¿va en esta spec o en otra aparte?
3. 3) Para la vista, ¿qué cambia? Recomiendo: usar la identidad de la Comunidad (fondo marino #14265C y acento oro #EFC02F en lugar del azul #2563EB fijo); poner el logo real del grupo en vez del emoji ⚜️; agregar un botón para mostrar u ocultar la contraseña; mostrar el error del servidor en línea, anunciado a lectores de pantalla (aria-live); y verificar que funcione en tema claro y oscuro y en el celular. Quedan FUERA 'Olvidé mi contraseña' y 'Recordarme', porque las contraseñas las administra el admin. ¿Estás de acuerdo o quieres algo distinto, por ejemplo los colores del grupo en lugar de los de Caminantes, ya que el login es de todo el grupo?

**Respuesta:**

Mis respuestas en nombre de Mario, ronda 1:

**1) Validaciones: sí, tal como las propones, con dos ajustes.**
- **Frontend:** Reactive Forms dentro de un `<form>` real. El repo ya usa `FormBuilder` en `crear-solicitud`, `registro-caminante`, `crear-informe` y `crear-ciclo`, así que es la convención. Correo obligatorio, con formato válido, sin espacios y en minúsculas. Contraseña obligatoria. Los errores van debajo de cada campo y se muestran al salir del campo o al intentar enviar. El botón queda bloqueado mientras carga.
  - **Ajuste 1:** **no** pongas una longitud mínima de contraseña al iniciar sesión. Las contraseñas las genera el admin al azar (`seedUsers`) y una regla nueva podría dejar fuera a alguien con una contraseña vieja. Las reglas de fuerza van donde se crean contraseñas (Usuarios), no en el login.
- **Backend:** en `backend/src/auth/dto/login.dto.ts`, que hoy solo tiene `@IsEmail` y `@IsNotEmpty`, agrega `@Transform` con trim y minúsculas (ya se usa en `evidencias/dto/create-evidencia.dto.ts`) y `@MaxLength(254)` para el correo y `@MaxLength(128)` para la contraseña. Los mensajes van en español.
  - **Ajuste 2:** no veo ningún `toLowerCase` en `auth` ni en `usuarios`, así que puede haber correos guardados con mayúsculas. Si eso pasa, al pasar el correo a minúsculas esa persona ya no podría entrar. La búsqueda del usuario en el login tiene que ignorar mayúsculas (`LOWER(email)`), o hay que revisar antes la BD del Pi. *Esto es un supuesto que no pude confirmar.*

**2) Fuerza bruta: sí, y en esta misma spec.**
- Usa `@nestjs/throttler`, que no está en `backend/package.json`, así que es una dependencia nueva. Límite de 5 intentos por minuto **solo en `POST /api/auth/login`**, no global, para no afectar al resto de la API. Devuelve 429 con el mensaje "Demasiados intentos, espera un momento" y muéstralo en línea en el login.
- Me baso en que el repo es público y la app está en internet desde la Raspberry (memoria de despliegue).
- **Supuesto a verificar:** si en el Pi hay un proxy adelante, hay que configurar `trust proxy`. Si no, todos los usuarios comparten la IP del proxy y entre todos se gastarían los 5 intentos.

**3) Vista: de acuerdo, con un cambio en el logo.**
- **Logo:** usa el **logo del Grupo**, no el de Caminantes. El login es de todo el grupo: el título ya dice "Grupo Scout 7 · Itsï Tarhiata" y los PDF usan `logo_Grupo`. El archivo ya existe en `frontend/src/assets/images/logo-grupo.png`, pero pesa unos 195 KB. Haz una versión reducida (unos 160 px, con `width`/`height` y `alt="Grupo Scout 7 Itsï Tarhiata"`) para no hacer más lenta la primera carga.
- **Colores:** marino `#14265C` y oro `#EFC02F` (memoria de identidad visual), en lugar del `#2563EB` fijo. El fondo actual (`#1B2A4A`) ya es marino, así que es coherente. No hay una paleta del Grupo documentada; si Mario la tiene, se cambia después. Revisa el contraste del texto sobre el botón oro: lo más probable es que necesite texto marino oscuro, no blanco.
- **Lo demás, como lo propones:** botón para mostrar u ocultar la contraseña (con `aria-label` y `aria-pressed`), el error del servidor en línea con `aria-live`, en lugar del toast actual, y que funcione en tema claro y oscuro y en el celular. Usa `autocomplete="email"` y `"current-password"`.
- **Fuera de alcance:** "Olvidé mi contraseña" y "Recordarme".

### Ronda 2

1. 1) ¿Cómo resolvemos las mayúsculas en el correo? Recomiendo: (a) en el login buscar sin distinguir mayúsculas (`LOWER(email) = LOWER(:email)` en un método nuevo `findByEmailInsensitive`, o cambiando `findByEmail`); (b) en `create` y `update` de `users.service.ts` guardar desde ahora el correo con trim y en minúsculas, y que la búsqueda de 'ya existe' tampoco distinga mayúsculas; (c) NO hacer una migración que reescriba los correos existentes. Si en la BD hubiera dos cuentas que solo se distinguen por mayúsculas, el login rechaza el acceso a ambas y se registra en el log, en vez de entrar a cualquiera de las dos. ¿Incluimos (b) en esta spec o lo dejamos solo en el login?
2. 2) ¿Cómo llega el tráfico a la Raspberry: solo por la red local (`raspberrypi.local`), o también desde internet (túnel, Cloudflare, puerto abierto)? ¿Y el frontend hace de proxy de `/api` (nginx en el contenedor)? Esto decide la clave del límite de intentos. Recomiendo: activar `trust proxy` en Express solo para el proxy propio (1 salto) y que el throttler cuente por **IP + correo normalizado** (5 intentos por minuto), no solo por IP. Así, en una reunión con 20 jóvenes en el mismo Wi-Fi (que salen por la misma IP pública si es por internet), nadie bloquea a los demás, y adivinar la contraseña de una cuenta sigue limitado. Almacenamiento en memoria, porque es una sola instancia. ¿De acuerdo?
3. 3) ¿Qué pruebas exige esta spec? Recomiendo: en el backend, pruebas unitarias de `AuthService.login` (correo con mayúsculas o espacios entra, contraseña mala → 401 genérico, usuario inactivo → 401 genérico) y una prueba e2e o de controlador de que el sexto intento en un minuto devuelve 429 en español. En el frontend, una prueba del `LoginComponent` para la validación de campos y para que el botón se bloquee mientras carga. Además, una verificación manual en el celular y en ambos temas. Si el repo no tiene Jest o Karma configurados y funcionando, ¿se configuran en esta spec o solo hacemos la verificación manual?

**Respuesta:**

Respuestas de la ronda 2:

**1) Mayúsculas: sí a (a), (b) y (c), y (b) entra en esta spec.**
- Cambia `findByEmail` en `backend/src/users/users.service.ts` en lugar de crear un método nuevo. Lo usa `auth.service.ts`, y conviene que la búsqueda de "ya existe" use la misma regla; con un solo método ninguna de las dos se queda atrás.
- `create` y `update` guardan el correo con trim y en minúsculas desde ahora.
- Sin migración.
- Si encuentra dos cuentas que solo se distinguen por mayúsculas, rechaza las dos y lo registra en el log, como propones.
- Por qué (b) va aquí: es poco código, y si no se hace, el admin podría crear `Juan@x.com` además de `juan@x.com` y caer justo en el caso que bloquea a los dos.
- **Supuesto:** no revisé si en la BD del Pi ya hay correos duplicados con distintas mayúsculas. Agrega a la spec una tarea de revisarlo con una consulta de solo lectura antes de desplegar.

**2) Tráfico y límite de intentos: de acuerdo con contar por IP + correo normalizado, en memoria. Pero `trust proxy` de 1 salto probablemente no basta.**
- El tráfico llega desde internet y desde la red local. La memoria de despliegue dice: dominio público `https://scouts.itsitarhiata.com`, pasando por Cloudflare hasta la Raspberry, y también se entra por `raspberrypi.local`.
- `frontend/nginx.conf` sí hace de proxy de `/api/` hacia `backend:3000` y manda `X-Real-IP` y `X-Forwarded-For`.
- Cloudflare no aparece en `docker-compose.prod.yml`, así que debe correr fuera, ya sea `cloudflared` en el Pi o un puerto abierto. *No pude confirmarlo.* Con un túnel, nginx ve como origen la IP de `cloudflared`. Con 1 salto, todos los usuarios de internet contarían como la misma IP.
- Decisión: la clave es IP + correo, así que aunque la IP salga mal nadie bloquea a los demás. Para la IP, la spec incluye verificar en el Pi qué IP ve el backend (un log temporal) y fijar `trust proxy` según los saltos reales.
- No confíes en `CF-Connecting-IP` sin más: quien entra por la red local podría falsificarlo.

**3) Pruebas: solo verificación manual en esta spec.**
- El repo no tiene nada de pruebas configurado: `backend/package.json` no tiene script `test` ni Jest, `frontend/package.json` no tiene `test`, y no hay ningún `*.spec.ts`. El `ng test` que menciona CLAUDE.md dice "si está configurado", y no lo está.
- Configurar Jest y Karma es trabajo aparte, para otra spec.
- Aquí basta con una lista de verificación manual escrita en la spec:
  - correo con mayúsculas o espacios entra;
  - contraseña mala da un 401 con mensaje genérico;
  - usuario inactivo da 401;
  - el sexto intento en un minuto da 429 con el mensaje en español, probado con `curl`;
  - la validación de campos y el botón bloqueado mientras carga;
  - tema claro y oscuro, en el celular;
  - navegación solo con teclado y con lector de pantalla.
- Siguiendo la memoria de limpieza, la spec debe pedir que se borre todo lo que dejen estas pruebas: cuentas de prueba, logs temporales y el log de IP.

### Ronda 3

1. 1) ¿Cada cuánto inicia sesión el `mcp-server/` contra `POST /api/auth/login`: una vez, guardando el token durante sus 8 h, o en cada llamada a una herramienta? Revísalo en el código de `mcp-server/`. Recomiendo: si ya guarda el token, no cambia nada, porque es una sola cuenta por servidor y nunca falla 5 veces seguidas. Si inicia sesión en cada llamada, en esta spec se cambia para que guarde el token y vuelva a entrar solo cuando reciba un 401, en lugar de eximirlo del límite. Una excepción del throttler por IP o por cabecera sería un hueco en un repo público. ¿Y el bot de Telegram u otro proceso también llama al login?
2. 2) Además de `UsersService.create` y `update`, ¿hay otros lugares que crean o cambian cuentas sin pasar por ellos? Por ejemplo: el alta de jóvenes en `caminantes`, que podría crear su usuario `scout`; los DTO de `usuarios`; `seedUsers`; la importación de tutores; o llamadas directas a `usersRepository.save`. Recomiendo: hacer la normalización (trim y minúsculas) en un solo punto que no se pueda saltar, con un hook `@BeforeInsert`/`@BeforeUpdate` en la entidad `User`, o un transformer de columna en `email`, en lugar de repetirla en cada servicio. Y agregar `@Transform` en los DTO que reciben correo, para que la validación vea el valor ya limpio. ¿De acuerdo, o prefieres limitarlo a `UsersService`?
3. 3) Cuando el login devuelve 429, ¿qué ve la persona? Recomiendo: mensaje en línea 'Demasiados intentos. Espera N segundos e inténtalo de nuevo', con N tomado de la cabecera `Retry-After` que manda el throttler, y el botón deshabilitado con una cuenta regresiva hasta que pase ese tiempo, sin bloquear los campos. Un error de red o un 5xx muestra 'No pudimos conectar con el servidor, revisa tu conexión' (distinto de 'Correo o contraseña incorrectos'). El texto que venga del backend NO se muestra tal cual, salvo en 401 y 429, para no filtrar mensajes técnicos. ¿De acuerdo?

**Respuesta:**

Respuestas de la ronda 3:

**1) MCP y otros procesos que llaman al login: no cambia nada.**
- `mcp-server/src/api.ts` ya guarda el token. Lo tiene en una variable del módulo (`let token`, línea 10) y solo vuelve a llamar a `login()` cuando no tiene token o cuando recibe un 401 (líneas 34, 49, 77 y 84). Es justo lo que recomiendas, así que no hay que cambiarlo ni darle una excepción en el throttler.
- El bot de Telegram (`backend/src/telegram/telegram.service.ts`) no llama al login: corre dentro del backend y usa el repositorio directamente.
- En `backend/src`, `frontend/src` y `mcp-server/src`, el único otro lugar que llama a `auth/login` es el frontend.
- Una nota para la spec: con la clave IP + correo, si alguien prueba contraseñas contra la cuenta del MCP desde la misma IP, el MCP podría recibir un 429 al renovar el token. Es poco probable y se recupera solo en un minuto, así que basta con que el MCP muestre ese error con claridad. *Esto es un supuesto; no probé cómo maneja hoy un 429.*

**2) Un solo punto de normalización: sí, pero con un transformer de columna, no con `@BeforeInsert`/`@BeforeUpdate`.**
- Hay escrituras que no pasan por `UsersService`:
  - `caminantes.service.ts:79-96`: el alta de un joven crea su usuario con `userRepo.create` y `save`, y recibe `email` desde `create-caminante.dto.ts:39`.
  - `users.service.ts:52` y `:90` usan `usersRepository.update(...)`.
- Por qué el transformer: **los hooks `@BeforeUpdate` no se ejecutan con `repository.update()`**, solo con `save()`, así que habría un hueco. Un `transformer` en la columna `email` de la entidad `User` (con `to` que hace trim y minúsculas) sí se aplica en `save`, en `update` y en los `where`.
- Ojo: el transformer pasa a minúsculas lo que se busca, pero no lo que ya está guardado. El login sigue necesitando `LOWER(email) = LOWER(:email)` para los correos viejos con mayúsculas.
- Agrega `@Transform` (trim y minúsculas) en `login.dto.ts`, `create-user.dto.ts`, `update-user.dto.ts` y `create-caminante.dto.ts`.
- `tutores.dto.ts` queda **fuera**: es el correo de contacto de los papás, no una cuenta para entrar.
- `seedUsers` también queda cubierto por el transformer.

**3) Qué ve la persona ante un 429: de acuerdo, con tres precisiones.**
- **Todos los textos los define el frontend**, también el de 401. Muestra siempre "Correo o contraseña incorrectos" y nunca el `err.error.message` del backend, que es lo que hace hoy `login.component.ts` en la rama `error`. Es más sencillo y no se filtra nada técnico.
  - Un 400 (que no debería pasar, porque el frontend ya valida) usa el mismo mensaje genérico.
  - Un error de red o un 5xx muestra "No pudimos conectar con el servidor, revisa tu conexión".
- **`Retry-After`:** el throttler lo manda y el navegador puede leerlo porque el frontend y `/api` están en el mismo origen. En producción pasan por nginx (`frontend/nginx.conf`) y en desarrollo por `proxy.conf.json`. Si la cabecera no llega, usa 60 s por defecto.
- **Accesibilidad de la cuenta regresiva:** `aria-live` solo anuncia el mensaje al empezar ("Espera 60 segundos…") y al terminar ("Ya puedes intentarlo de nuevo"), no cada segundo. El número que cambia va en el botón deshabilitado, sin `aria-live`. Los campos siguen editables, como propones.
