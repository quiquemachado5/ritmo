import { appendFile, readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = path.join(process.cwd(), ".next", "static", "chunks");
const totalLimitKb = Number(process.env.RITMO_JS_TOTAL_GZIP_KB || 700);
const chunkLimitKb = Number(process.env.RITMO_JS_CHUNK_GZIP_KB || 130);
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith(".js")) files.push(file);
  }
}
await walk(root);
const sizes = await Promise.all(files.map(async (file) => ({ file, bytes: gzipSync(await readFile(file)).byteLength })));
const totalKb = sizes.reduce((sum, item) => sum + item.bytes, 0) / 1024;
const largest = sizes.sort((a, b) => b.bytes - a.bytes)[0];
const largestKb = (largest?.bytes || 0) / 1024;
const report = `JavaScript: ${totalKb.toFixed(1)} kB gzip total · mayor chunk ${largestKb.toFixed(1)} kB · límites ${totalLimitKb}/${chunkLimitKb} kB`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Presupuesto móvil\n${report}\n`);
if (totalKb > totalLimitKb || largestKb > chunkLimitKb) {
  throw new Error(`Presupuesto de JavaScript excedido. Mayor: ${largest ? path.relative(process.cwd(), largest.file) : "—"}`);
}
