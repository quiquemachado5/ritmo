import process from "node:process";

const rawBase = process.env.RITMO_DEPLOYMENT_URL;
if (!rawBase) throw new Error("Falta RITMO_DEPLOYMENT_URL.");
const base = new URL(rawBase);
if (base.protocol !== "https:") throw new Error("El despliegue debe usar HTTPS.");

async function comprobar(ruta, validar) {
  let ultimoError;
  for (let intento = 1; intento <= 5; intento++) {
    try {
      const respuesta = await fetch(new URL(ruta, base), { headers: { "User-Agent": "RITMO deployment smoke" }, signal: AbortSignal.timeout(10_000) });
      if (!respuesta.ok) throw new Error(`${ruta} respondió ${respuesta.status}`);
      if (validar) await validar(respuesta);
      return;
    } catch (error) {
      ultimoError = error;
      if (intento < 5) await new Promise(resolve => setTimeout(resolve, 5_000));
    }
  }
  throw ultimoError;
}

await comprobar("/api/health", async respuesta => {
  const dato = await respuesta.json();
  if (dato?.status !== "ok" || dato?.database !== "ready") throw new Error("Código y base de datos no están alineados.");
});
await comprobar("/login");
await comprobar("/privacidad");

console.log(`Despliegue comprobado: ${base.origin}`);
