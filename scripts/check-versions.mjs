import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const versions = JSON.parse(await readFile(path.join(root, "config/versions.json"), "utf8"));
const migrations = (await readdir(path.join(root, "supabase/migrations")))
  .filter((name) => /^\d{12,14}_.+\.sql$/.test(name))
  .sort();

if (!Number.isInteger(versions.backupFormat) || versions.backupFormat < 1) {
  throw new Error("backupFormat debe ser un entero positivo.");
}
if (!Number.isInteger(versions.cacheSchema) || versions.cacheSchema < 1) {
  throw new Error("cacheSchema debe ser un entero positivo.");
}

const latest = migrations.at(-1)?.split("_")[0];
if (!latest || latest !== versions.databaseMigration) {
  throw new Error(`La última migración (${latest ?? "ninguna"}) no coincide con databaseMigration (${versions.databaseMigration}).`);
}

console.log(`Versiones coherentes · backup v${versions.backupFormat} · cache v${versions.cacheSchema} · BD ${latest}`);
