// Doble local de transporte, exclusivamente para QA visual. No usa cuentas reales.
import http from 'node:http';
const stores = new Map();
let tick = 0;
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
function user(id = ids[0]) { return { id, aud: 'authenticated', role: 'authenticated', email: id === ids[0] ? 'alex@ritmo.test' : 'bea@ritmo.test', created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} }; }
function session(id) {
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return { access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: id, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })}.local-test-signature`, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `test-${id}`, user: user(id) };
}
function state(id) {
  if (!stores.has(id)) {
    const days = Array.from({ length: 36 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i); const fecha = d.toLocaleDateString('en-CA');
      return { user_id: id, fecha, habitos: { comida: true, cena: i % 3 !== 0, noAlcohol: true, deporte: i % 2 === 0, beberAgua: true, dormirBien: i % 4 !== 0 }, peso: i % 7 === 0 ? 80 + i / 60 : null, kcal_consumidas: i === 0 ? 480 : null, kcal_quemadas: null, grasa_pct: null, notas: null, actualizado_en: '2026-09-01T00:00:00Z', comidas: i === 0 ? [{ id: 'fixture-meal', tipo: 'comida', texto: 'Arroz con verduras y pollo', kcal: 480, proteinas: 30, carbohidratos: 55, grasas: 15, estimado: true, ingredientes: [{ nombre: 'Arroz cocido', cantidad: '150 g', cantidadEstimada: false, kcal: 195, proteinas: 4, carbohidratos: 42, grasas: 1 }] }] : [] };
    });
    stores.set(id, { perfiles: [{ user_id: id, nombre: id === ids[0] ? 'Alex' : 'Bea', edad: 30, altura_cm: 175, sexo: 'hombre', objetivo: 'mantener', kcal_objetivo: 2100, proteina_objetivo: 1.6, factor_actividad: 1.375, umbral_racha: 6, onboarding_completo: true, actualizado_en: '2026-09-01T00:00:00Z' }], dias: days, composicion: days.filter(d => d.peso).map(d => ({ user_id: id, fecha: d.fecha, peso: d.peso, actualizado_en: d.actualizado_en })), user_prefs: [] });
  }
  return stores.get(id);
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:3199');
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw && req.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : {};
  const send = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/health') return send({ ok: true });
  if (url.pathname === '/__reset') { stores.clear(); return send({ ok: true }); }
  let id = ids[0];
  try { id = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1], 'base64url').toString()).sub; } catch {}
  if (!ids.includes(id)) return send({ message: 'Invalid local test user' }, 401);
  if (url.pathname.endsWith('/token')) return send(session(body.email === 'bea@ritmo.test' ? ids[1] : ids[0]));
  if (url.pathname.endsWith('/user')) return send(user(id));
  if (url.pathname.endsWith('/logout')) return send({});
  if (url.pathname.includes('/rpc/ritmo_user_count')) return send(2);
  if (url.pathname.startsWith('/storage/')) return send({ Key: 'fixture' });
  if (url.pathname.startsWith('/rest/v1/')) {
    const table = url.pathname.split('/').at(-1); const db = state(id);
    if (!db[table]) return send([]);
    const matches = row => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3));
    let rows = db[table].filter(matches);
    if (req.method === 'POST') {
      const entries = Array.isArray(body) ? body : [body]; rows = [];
      for (const entry of entries) {
        const index = db[table].findIndex(row => row.user_id === entry.user_id && row.fecha === entry.fecha);
        if (index >= 0 && !req.headers.prefer?.includes('resolution=merge-duplicates')) return send({ code: '23505', message: 'duplicate' }, 409);
        const row = { ...entry, actualizado_en: new Date(Date.now() + ++tick).toISOString() };
        if (index >= 0) db[table][index] = row; else db[table].push(row); rows.push(row);
      }
    } else if (req.method === 'PATCH') {
      rows.forEach(row => Object.assign(row, body, { actualizado_en: new Date(Date.now() + ++tick).toISOString() }));
    } else if (req.method === 'DELETE') { db[table] = db[table].filter(row => !matches(row)); }
    res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
    return send(req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
  }
  return send({});
});
server.listen(3199, '127.0.0.1', () => console.log('Supabase simulado listo: solo datos sintéticos.'));
