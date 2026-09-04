import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
try {
  await db.exec(await readFile('scripts/ci-bootstrap.sql', 'utf8'));
  for (const name of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
    console.log(`Migración verificada: ${name}`);
  }
  await db.exec((await readFile('scripts/ci-rls.sql', 'utf8')).replace(/^\\set.*$/gm, ''));
  console.log('Aislamiento entre cuentas, proteína decimal y presupuesto de IA: correctos.');
} finally { await db.close(); }
