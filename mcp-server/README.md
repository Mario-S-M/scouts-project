# scouts-cc MCP

Servidor MCP que conecta Claude Desktop (y Claude Code) con la API de scouts-app.
Desde una conversación con Claude se pueden crear y publicar avisos de salida,
informes mensuales, solicitudes de insignias y ciclos de programa.

- Los PDFs se guardan en la carpeta de **Google Drive del grupo** (vía Google Drive para escritorio).
- Para avisar a los papás se arma un enlace `wa.me` con el mensaje listo: se abre WhatsApp y eliges el grupo de papás.

El servidor solo habla con la API REST (como el frontend); no toca la base de datos.

## Instalación

```bash
cd mcp-server
npm install
npm run build
```

El backend debe estar corriendo (`docker-compose up -d` en la raíz del repo).

## Variables de entorno

| Variable | Para qué |
|---|---|
| `SCOUTS_API_URL` | URL de la API. Default `http://localhost:3000/api`. Para el Pi: `http://<ip-del-pi>:3002/api` |
| `SCOUTS_EMAIL` / `SCOUTS_PASSWORD` | Cuenta de la app con la que actúa Claude |
| `SCOUTS_DRIVE_DIR` | Carpeta local del grupo sincronizada por Drive, p. ej. `~/Library/CloudStorage/GoogleDrive-<correo>/Mi unidad/Grupo 7` |
| `SCOUTS_DRIVE_FOLDER_URL` | Link web de esa carpeta; se usa si Drive aún no terminó de subir el archivo |

Sin `SCOUTS_DRIVE_DIR` los PDFs se guardan en `~/Downloads/Scouts`.

Dentro de la carpeta se usan `Documentos <año>/` (una carpeta por salida), `Informes de Sección/<Sección>/<año>/`,
`Ciclos de Programa/` y `Solicitudes de Insignias/`. Comparte la carpeta del grupo
como "Cualquier persona con el enlace puede ver" para que los papás abran los PDFs.

## Claude Desktop

En `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "scouts-cc": {
      "command": "/Users/mario-e-s-m/.nvm/versions/node/v24.19.0/bin/node",
      "args": ["/Users/mario-e-s-m/Documents/Nuevo-Programa-Scouts-CC/scouts-app/mcp-server/dist/index.js"],
      "env": {
        "SCOUTS_API_URL": "http://localhost:3000/api",
        "SCOUTS_EMAIL": "tu-correo",
        "SCOUTS_PASSWORD": "tu-contraseña",
        "SCOUTS_DRIVE_DIR": "~/Library/CloudStorage/GoogleDrive-<correo>/Mi unidad/<carpeta del grupo>",
        "SCOUTS_DRIVE_FOLDER_URL": "https://drive.google.com/drive/folders/<id>"
      }
    }
  }
}
```

Usa la ruta absoluta de `node` (`which node`): Claude Desktop no carga el PATH de nvm.
Reinicia Claude Desktop (Cmd+Q y abrir de nuevo).

## Claude Code

```bash
claude mcp add scouts-cc -s user \
  -e SCOUTS_EMAIL=tu-correo -e SCOUTS_PASSWORD=tu-contraseña \
  -e SCOUTS_DRIVE_DIR="~/Library/CloudStorage/GoogleDrive-<correo>/Mi unidad/<carpeta>" \
  -- node /Users/mario-e-s-m/Documents/Nuevo-Programa-Scouts-CC/scouts-app/mcp-server/dist/index.js
```

## Herramientas

- **Consultas:** `quien_soy`, `listar_caminantes`, `ver_caminante`, `listar_staff`, `calendario_mes`, `dashboard`
- **Avisos de salida:** `listar_avisos`, `ver_aviso`, `crear_aviso`, `actualizar_aviso`, `publicar_aviso`, `publicar_protocolo`, `descargar_permisos_zip`
- **Informes:** `listar_informes`, `ver_informe`, `crear_informe`, `actualizar_seccion_informe`, `importar_insignias_a_informe`, `publicar_informe`, `publicar_informe_anual`
- **Insignias:** `catalogo_insignias`, `sugerencias_insignias`, `listar_solicitudes_insignias`, `crear_solicitud_insignias`, `publicar_solicitud_insignias`
- **Ciclos de programa:** `listar_ciclos`, `crear_ciclo`, `actualizar_ciclo`, `publicar_ciclo`
- **WhatsApp:** `mensaje_whatsapp_papas` (las `publicar_*` ya devuelven su enlace)

Ejemplos de lo que puedes pedir:

- "Haz el aviso de salida de la excursión del sábado 14 al Punhuato con toda la Comunidad, sale a las 7:30 del local y regresa a las 6, cuesta $150. Publícalo."
- "Crea el informe de octubre de comunidad, importa las solicitudes de insignias y súbelo a Drive."
- "Arma el ciclo de programa de enero a marzo con estas actividades… y mándalo al grupo de papás."

## Avisos de salida y protocolo de traslado

- Por defecto van todos los caminantes activos de la sección y los scouters de `SCOUTS_SCOUTERS_DEFAULT`.
- Todo aviso lleva **protocolo de seguridad en el traslado** (formato oficial CNAR). Coordinador,
  enlace y transporte vienen de `backend/src/avisos-salida/protocolo-traslado.types.ts`; Claude
  pregunta el resto. `publicar_aviso` no publica mientras falten datos.
- Cada salida tiene su carpeta en `Documentos <año>/<fecha> <nombre>/` con tres subcarpetas:
  `Aviso de salida/`, `Protocolo de traslado/` (Word oficial + PDF) y `Permiso de padres/`.
  La copia en PDF necesita LibreOffice en la Mac (`brew install --cask libreoffice`); `SCOUTS_SOFFICE` cambia la ruta.
- Si CNAR cambia el formato: `python3 backend/scripts/crear-plantilla-protocolo.py <nuevo.docx>`.

## Notas

- Las credenciales quedan en texto plano en el config local; usa HTTPS si apuntas al Pi por internet.
- Las respuestas nunca incluyen contraseñas (hash) ni códigos de Telegram.
- El ZIP de permisos individuales lleva datos personales: es para el staff, no para el grupo de papás.
