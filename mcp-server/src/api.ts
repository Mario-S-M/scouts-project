/**
 * Cliente HTTP de la API de scouts-app. Hace login con las credenciales de
 * entorno, guarda el JWT en memoria y re-hace login una vez si llega un 401.
 */

const API_URL = (process.env.SCOUTS_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const EMAIL = process.env.SCOUTS_EMAIL || '';
const PASSWORD = process.env.SCOUTS_PASSWORD || '';

let token: string | null = null;
let usuario: { id: number; nombre: string; email: string; rol: string } | null = null;

async function login(): Promise<void> {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Faltan SCOUTS_EMAIL / SCOUTS_PASSWORD en la configuración del servidor MCP.');
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
  } catch {
    throw new Error(`No se pudo conectar con la app en ${API_URL}. ¿Está levantado el backend (docker-compose up -d)?`);
  }
  if (!res.ok) throw new Error(`Login fallido (${res.status}): revisa SCOUTS_EMAIL / SCOUTS_PASSWORD.`);
  const body = (await res.json()) as { access_token: string; user: typeof usuario };
  token = body.access_token;
  usuario = body.user;
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<Response> {
  if (!token) await login();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`No se pudo conectar con la app en ${API_URL}.`);
  }
  if (res.status === 401 && retry) {
    token = null;
    return request(method, path, body, false);
  }
  if (!res.ok) {
    const text = await res.text();
    let detalle = text;
    try {
      const j = JSON.parse(text);
      detalle = Array.isArray(j.message) ? j.message.join('; ') : (j.message ?? text);
    } catch { /* texto plano */ }
    throw new Error(`${method} ${path} → ${res.status}: ${detalle}`);
  }
  return res;
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function apiBinary(method: string, path: string, body?: unknown): Promise<Buffer> {
  const res = await request(method, path, body);
  return Buffer.from(await res.arrayBuffer());
}

export async function usuarioActual() {
  if (!usuario) await login();
  return usuario!;
}

export { API_URL };
