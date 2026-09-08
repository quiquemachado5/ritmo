import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PERFIL_DEFECTO } from "../../model/config";
import { VERSION_MODELO_CANDIDATO, VERSION_MODELO_ESTABLE } from "../lifecycle";

describe("Sellado de auditoría en base de datos", () => {
  it("aísla cuentas, no permite reescritura ni fechas pasadas y borra solo el historial propio", async () => {
    const db = new PGlite();
    const uno = "00000000-0000-4000-8000-000000000011";
    const dos = "00000000-0000-4000-8000-000000000012";
    try {
      await db.exec(await readFile("scripts/ci-bootstrap.sql", "utf8"));
      for (const name of (await readdir("supabase/migrations")).filter((n) => n.endsWith(".sql")).sort()) {
        await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
      }
      await db.exec(`insert into auth.users(id) values('${uno}'),('${dos}'); set role authenticated;`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uno]);
      const hoy = (await db.query<{ fecha: string }>("select (now() at time zone 'UTC')::date::text as fecha")).rows[0].fecha;
      const guardarPerfil = () => db.query("select (public.model_audit_snapshot($1::jsonb,'UTC')).*", [JSON.stringify(PERFIL_DEFECTO)]);
      const primera = await guardarPerfil();
      const configId = (primera.rows[0] as { id: string }).id;
      const segunda = await guardarPerfil();
      expect(segunda.rows[0]).toEqual(primera.rows[0]);
      await expect(db.query("select public.model_audit_snapshot($1::jsonb,'UTC')", [JSON.stringify({ ...PERFIL_DEFECTO, edad: null })])).rejects.toThrow(/invalid model profile/);
      const forecast = { horizonteDias: 1, peso: 90, minimo: 89, maximo: 91, pesoBase: 90.1, fechaBase: hoy, versionModelo: VERSION_MODELO_ESTABLE, diasUtilizados: 10, pesajesUtilizados: 2 };
      const emitida = await db.query("select * from public.model_audit_forecast($1::date,'UTC',$2::jsonb,$3::uuid)", [hoy, JSON.stringify([forecast]), configId]);
      const repetida = await db.query("select * from public.model_audit_forecast($1::date,'UTC',$2::jsonb,$3::uuid)", [hoy, JSON.stringify([{ ...forecast, peso: 90.9 }]), configId]);
      expect(repetida.rows).toEqual(emitida.rows);
      const conCandidato = await db.query("select * from public.model_audit_forecast($1::date,'UTC',$2::jsonb,$3::uuid)", [hoy, JSON.stringify([{ ...forecast, versionModelo: VERSION_MODELO_CANDIDATO, peso: 90.2 }]), configId]);
      expect(conCandidato.rows).toHaveLength(2);
      await expect(db.query("select * from public.model_audit_forecast('2020-01-01','UTC',$1::jsonb,$2::uuid)", [JSON.stringify([forecast]), configId])).rejects.toThrow(/emission date must be today/);
      await expect(db.exec("update public.predicciones_modelo set peso=80")).rejects.toThrow(/permission denied/);
      await expect(db.exec("update public.historial_modelo set effective_date='2020-01-01'")).rejects.toThrow(/permission denied/);
      // Un pesaje futuro ya anotado no se convierte en un acierto de predicción.
      await db.query("insert into public.dias(user_id,fecha,peso) values(auth.uid(),$1::date+3,88)", [hoy]);
      const futuroAnotado = await db.query("select * from public.model_audit_forecast($1::date,'UTC',$2::jsonb,$3::uuid)", [hoy, JSON.stringify([{ ...forecast, horizonteDias: 3, peso: 88, minimo: 87, maximo: 89 }]), configId]);
      expect(futuroAnotado.rows).toHaveLength(2); // Solo devuelve las variantes de mañana ya emitidas.
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [dos]);
      expect((await db.query("select * from public.predicciones_modelo")).rows).toHaveLength(0);
      expect((await db.query("select * from public.historial_modelo")).rows).toHaveLength(0);
      await guardarPerfil();
      await db.exec("select public.clear_my_model_audit()");
      expect((await db.query("select * from public.historial_modelo")).rows).toHaveLength(0);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uno]);
      expect((await db.query("select * from public.predicciones_modelo")).rows).toHaveLength(2);
      await db.exec("select public.clear_my_model_audit()");
      expect((await db.query("select * from public.historial_modelo")).rows).toHaveLength(0);
      expect((await db.query("select * from public.predicciones_modelo")).rows).toHaveLength(0);
    } finally { await db.close(); }
  }, 60000);
});
