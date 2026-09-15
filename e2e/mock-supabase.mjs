// Doble local de transporte, exclusivamente para QA visual. No usa cuentas reales.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
const stores = new Map();
let tick = 0;
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
const features = [
  ['nutrition_engine','Motor nutricional'],
  ['nutrition_memory','Memoria nutricional'], ['fluid_context','Contexto de líquidos'],
  ['data_health','Salud de datos'],
  ['interfaz_viva','Interfaz viva'], ['rescate_automatico','Rescate automático'],
  ['detector_avanzado','Detector de señales'], ['escenarios','Escenarios de peso'],
  ['memoria_corporal','Memoria corporal'], ['modo_invisible','Lecturas en segundo plano'],
].map(([key,label]) => ({ key, label, description: `${label} en entorno de prueba.`, state: 'public', updatedAt: new Date().toISOString() }));
let platformControl = { weightModelMode: 'automatic', announcementEnabled: false, announcementText: '', updatedAt: new Date().toISOString() };
function user(id = ids[0]) { return { id, aud: 'authenticated', role: 'authenticated', email: id === ids[0] ? 'alex@ritmo.test' : 'quiquemachadodguez@gmail.com', created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} }; }
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
    stores.set(id, { perfiles: [{ user_id: id, nombre: id === ids[0] ? 'Alex' : 'Bea', edad: 30, altura_cm: 175, sexo: 'hombre', objetivo: 'mantener', kcal_objetivo: 2100, proteina_objetivo: 1.6, factor_actividad: 1.375, umbral_racha: 6, onboarding_completo: true, actualizado_en: '2026-09-01T00:00:00Z' }], dias: days, composicion: days.filter(d => d.peso).map(d => ({ user_id: id, fecha: d.fecha, peso: d.peso, actualizado_en: d.actualizado_en })), user_prefs: [], privacy_consents: [], historial_modelo: [], predicciones_modelo: [] });
  }
  return stores.get(id);
}
const server = http.createServer(async (req, res) => {
  // Solo el frontend QA en loopback. Authorization no queda cubierto por el
  // comodín de Allow-Headers; WebKit exige permitirlo explícitamente.
  const requestOrigin = req.headers.origin;
  const allowedOrigin = requestOrigin === 'http://localhost:3101' || requestOrigin === 'http://127.0.0.1:3101'
    ? requestOrigin
    : 'http://127.0.0.1:3101';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'authorization,apikey,content-type,x-client-info,prefer,range,range-unit,x-supabase-api-version,accept-profile,content-profile');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:3199');
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw && req.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : {};
  const send = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/health') return send({ ok: true });
  if (url.pathname === '/__reset') { stores.clear(); features.forEach(item => { item.state = 'public'; }); platformControl = { weightModelMode: 'automatic', announcementEnabled: false, announcementText: '', updatedAt: new Date().toISOString() }; return send({ ok: true }); }
  let id = ids[0];
  try { id = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1], 'base64url').toString()).sub; } catch {}
  if (!ids.includes(id)) return send({ message: 'Invalid local test user' }, 401);
  if (url.pathname.endsWith('/token')) return send(session(body.email === 'bea@ritmo.test' ? ids[1] : ids[0]));
  if (url.pathname.endsWith('/user')) return send(user(id));
  if (url.pathname.endsWith('/logout')) return send({});
  if (url.pathname.includes('/rpc/ritmo_user_count')) return send(2);
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const rpc = url.pathname.split('/').at(-1); const db = state(id);
    if (rpc === 'is_ritmo_admin') return send(id === ids[1]);
    if (rpc === 'ritmo_public_config') return send({
      features: Object.fromEntries(features.map(item => [item.key, item.state === 'public' || id === ids[1]])),
      weightModelMode: platformControl.weightModelMode,
      announcement: platformControl.announcementEnabled ? platformControl.announcementText : null,
      updatedAt: platformControl.updatedAt,
    });
    if (rpc === 'ritmo_public_runtime_status') return send({ databaseVersion: '202609150002', nutritionEngine: true });
    if (rpc === 'ritmo_import_data') {
      const upsert = (tabla, filas) => {
        for (const entrada of filas || []) {
          const fila = { ...entrada, user_id: id, actualizado_en: new Date(Date.now() + ++tick).toISOString() };
          const indice = db[tabla].findIndex(actual => actual.user_id === id && actual.fecha === fila.fecha);
          if (indice >= 0) db[tabla][indice] = fila; else db[tabla].push(fila);
        }
      };
      if (body.p_profile) {
        const perfil = { ...body.p_profile, user_id: id, actualizado_en: new Date(Date.now() + ++tick).toISOString() };
        const indice = db.perfiles.findIndex(actual => actual.user_id === id);
        if (indice >= 0) db.perfiles[indice] = perfil; else db.perfiles.push(perfil);
      }
      upsert('dias', body.p_days);
      upsert('composicion', body.p_measurements);
      return send({ profile: body.p_profile ? 1 : 0, days: body.p_days?.length || 0, measurements: body.p_measurements?.length || 0 });
    }
    if (rpc === 'ritmo_admin_snapshot') {
      if (id !== ids[1]) return send({ message: 'Acceso no autorizado' }, 403);
      return send({ metrics: { users: 2, onboarded: 2, active30: 2, suspended: 0, admins: 1, pilots: 0 }, features, control: platformControl, audit: [] });
    }
    if (rpc === 'ritmo_admin_users') {
      if (id !== ids[1]) return send({ message: 'Acceso no autorizado' }, 403);
      return send(ids.map((userId,index) => ({ user_id: userId, email_masked: index ? 'q••••••••@gmail.com' : 'a•••@ritmo.test', provider: 'email', created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString(), status: 'active', role: index ? 'admin' : 'user', onboarding_complete: true, is_self: userId === id })));
    }
    if (rpc === 'ritmo_admin_health') {
      if (id !== ids[1]) return send(null);
      return send({ windowHours: 24, total: 0, errors: 0, byEvent: {}, latestBuild: 'local-e2e' });
    }
    if (rpc === 'ritmo_admin_model_cohort') {
      if (id !== ids[1]) return send(null);
      return send({ minimumParticipants: 5, observedParticipants: 2, horizons: [] });
    }
    if (rpc === 'ritmo_grant_health_consent') {
      db.privacy_consents = [{ user_id: id, notice_version: body.p_version, health_tracking: true, granted_at: new Date().toISOString() }];
      return send(null);
    }
    if (rpc === 'ritmo_health_consent_status') return send(db.privacy_consents.length > 0);
    if (rpc === 'ritmo_revoke_health_consent') { db.privacy_consents = []; return send(null); }
    if (rpc === 'ritmo_record_health_event') return send(null);
    if (rpc === 'ritmo_admin_command') {
      if (id !== ids[1]) return send({ message: 'Acceso no autorizado' }, 403);
      const command = body.p_command || {};
      if (command.type === 'feature_state') { const feature = features.find(item => item.key === command.key); if (feature) feature.state = command.value; }
      if (command.type === 'weight_model_mode') platformControl.weightModelMode = command.value;
      if (command.type === 'announcement') { platformControl.announcementEnabled = Boolean(command.enabled); platformControl.announcementText = String(command.text || ''); }
      platformControl.updatedAt = new Date().toISOString();
      return send({ ok: true });
    }
    if (rpc === 'clear_my_model_audit') { db.predicciones_modelo = []; db.historial_modelo = []; return send(null); }
    if (rpc === 'model_audit_snapshot') {
      const previous = db.historial_modelo.at(-1);
      if (previous && JSON.stringify(previous.perfil) === JSON.stringify(body.p_perfil)) return send(previous);
      const now = new Date();
      const row = { id: randomUUID(), user_id: id, effective_from: now.toISOString(), effective_date: now.toLocaleDateString('en-CA', { timeZone: body.p_zona || 'UTC' }), perfil: body.p_perfil };
      db.historial_modelo.push(row); return send(row);
    }
    if (rpc === 'model_audit_forecast') {
      const config = db.historial_modelo.at(-1);
      if (!config || config.id !== body.p_configuracion) return send({ message: 'profile snapshot changed' }, 409);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: body.p_zona || 'UTC' });
      if (body.p_fecha !== today) return send({ message: 'emission date must be today' }, 400);
      for (const p of body.p_predicciones) {
        if (db.predicciones_modelo.some(x => x.fecha_emision === body.p_fecha && x.horizonte_dias === p.horizonteDias)) continue;
        const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + p.horizonteDias);
        const target = date.toISOString().slice(0, 10);
        if (db.dias.some(x => x.fecha === target && x.peso != null) || db.composicion.some(x => x.fecha === target)) continue;
        db.predicciones_modelo.push({ id: randomUUID(), user_id: id, emitida_en: new Date().toISOString(), fecha_emision: today, fecha_objetivo: target, horizonte_dias: p.horizonteDias, peso: p.peso, minimo: p.minimo, maximo: p.maximo, peso_base: p.pesoBase, fecha_base: p.fechaBase, version_modelo: p.versionModelo, configuracion_id: config.id, dias_utilizados: p.diasUtilizados, pesajes_utilizados: p.pesajesUtilizados });
      }
      return send(db.predicciones_modelo.filter(p => p.fecha_emision === today));
    }
    return send({ code: 'PGRST202', message: 'Unknown local test RPC' }, 404);
  }
  if (url.pathname.startsWith('/storage/')) return send({ Key: 'fixture' });
  if (url.pathname.startsWith('/rest/v1/')) {
    const table = url.pathname.split('/').at(-1); const db = state(id);
    if (!db[table]) return send({ code: '42P01', message: 'Unknown local test table' }, 404);
    const matches = row => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value.startsWith('gt.')) return String(row[key]) > value.slice(3);
      if (value.startsWith('gte.')) return String(row[key]) >= value.slice(4);
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').map(x => x.replace(/^"|"$/g, '')).includes(String(row[key]));
      return true;
    });
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
    const total = rows.length;
    const order = url.searchParams.get('order');
    if (order) rows.sort((a, b) => {
      for (const rule of order.split(',')) { const [field, direction] = rule.split('.'); const delta = String(a[field]).localeCompare(String(b[field])); if (delta) return direction === 'desc' ? -delta : delta; }
      return 0;
    });
    const [rangeStart, rangeEnd] = String(req.headers.range || '').split('-').map(Number);
    const offset = Number(url.searchParams.get('offset') || rangeStart || 0);
    const limit = Number(url.searchParams.get('limit') || (Number.isFinite(rangeEnd) ? rangeEnd - offset + 1 : total));
    rows = rows.slice(offset, offset + limit);
    const select = url.searchParams.get('select');
    if (select && select !== '*') rows = rows.map(row => Object.fromEntries(select.split(',').map(key => [key, row[key]])));
    res.setHeader('Content-Range', `${offset}-${Math.max(offset, offset + rows.length - 1)}/${total}`);
    return send(req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
  }
  return send({});
});
server.listen(3199, '127.0.0.1', () => console.log('Supabase simulado listo: solo datos sintéticos.'));
