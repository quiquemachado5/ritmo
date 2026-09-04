const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'E2E_USER_A_EMAIL', 'E2E_USER_A_PASSWORD', 'E2E_USER_B_EMAIL', 'E2E_USER_B_PASSWORD'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw new Error(`Faltan variables de pruebas (no de producción): ${missing.join(', ')}. Las pruebas autenticadas no se consideran aprobadas.`);
if (process.env.E2E_USER_A_EMAIL === process.env.E2E_USER_B_EMAIL) throw new Error('Las cuentas de prueba deben ser distintas.');
