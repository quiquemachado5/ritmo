import { describe, expect, it } from "vitest";
import { interpretarAppleHealthArchivo, interpretarAppleHealthXml, interpretarHealthConnectCsv, interpretarHealthConnectJson, prepararImportacionSalud } from "@/lib/health-import";
import { PERFIL_DEFECTO } from "@/lib/model/config";

describe("importación de Apple Health", () => {
  it("deduplica fuentes de pasos e intervalos de sueño y conserva el último peso", () => {
    const xml = `<?xml version="1.0"?><HealthData>
      <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Báscula" unit="kg" value="82.4" startDate="2026-09-14 08:00:00 +0200" endDate="2026-09-14 08:00:00 +0200" />
      <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Báscula" unit="kg" value="82.1" startDate="2026-09-14 09:00:00 +0200" endDate="2026-09-14 09:00:00 +0200" />
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" value="4000" startDate="2026-09-14 08:00:00 +0200" endDate="2026-09-14 20:00:00 +0200" />
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" value="5500" startDate="2026-09-14 08:00:00 +0200" endDate="2026-09-14 20:00:00 +0200" />
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-09-13 23:00:00 +0200" endDate="2026-09-14 03:00:00 +0200" />
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" value="HKCategoryValueSleepAnalysisAsleepREM" startDate="2026-09-14 02:30:00 +0200" endDate="2026-09-14 06:30:00 +0200" />
      <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="45" durationUnit="min" startDate="2026-09-14 18:00:00 +0200" endDate="2026-09-14 18:45:00 +0200" />
    </HealthData>`;
    const resultado = interpretarAppleHealthXml(xml);
    expect(resultado.fuente).toBe("apple-health");
    expect(resultado.dias["2026-09-14"]).toMatchObject({ peso: 82.1, pasos: 5500, suenoMinutos: 450, entrenamientoMinutos: 45 });
  });

  it("lee pesos del CDA aunque Apple concatene entradas después del documento", () => {
    const xml = `<?xml version="1.0"?><ClinicalDocument></ClinicalDocument>
      <entry><observation><text><sourceName>Báscula</sourceName><type>HKQuantityTypeIdentifierBodyMass</type></text>
      <effectiveTime><low value="20260914080000+0200"/><high value="20260914080000+0200"/></effectiveTime>
      <value xsi:type="PQ" value="81.7" unit="kg"/></observation></entry>`;
    const resultado = interpretarAppleHealthXml(xml);
    expect(resultado.dias["2026-09-14"]).toMatchObject({ peso: 81.7 });
  });

  it("ignora registros ajenos y lee export.xml por bloques", async () => {
    const relleno = `<Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" unit="km" value="1" startDate="2026-09-14 08:00:00 +0200"/>`.repeat(1_000);
    const xml = `<?xml version="1.0"?><HealthData>${relleno}<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" value="4321" startDate="2026-09-14 08:00:00 +0200" endDate="2026-09-14 20:00:00 +0200"/></HealthData>`;
    const resultado = await interpretarAppleHealthArchivo(new Blob([xml]));
    expect(resultado.registrosLeidos).toBe(1);
    expect(resultado.dias["2026-09-14"].pasos).toBe(4321);
  });

  it("acepta tiempo en cama y avisa de su menor precisión", () => {
    const resultado = interpretarAppleHealthXml(`<HealthData><Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-09-13 23:00:00 +0200" endDate="2026-09-14 07:00:00 +0200"/></HealthData>`);
    expect(resultado.dias["2026-09-14"].suenoMinutos).toBe(480);
    expect(resultado.avisos).toHaveLength(1);
  });
});

describe("importación de Health Connect", () => {
  it("interpreta los cuatro tipos de registro en JSON", () => {
    const resultado = interpretarHealthConnectJson(JSON.stringify({ records: [
      { recordType: "WeightRecord", time: "2026-09-12T08:00:00+02:00", weight: { inKilograms: 79.3 } },
      { recordType: "StepsRecord", startTime: "2026-09-12T08:00:00+02:00", count: 8123 },
      { recordType: "SleepSessionRecord", startTime: "2026-09-11T23:30:00+02:00", endTime: "2026-09-12T07:00:00+02:00" },
      { recordType: "ExerciseSessionRecord", startTime: "2026-09-12T18:00:00+02:00", endTime: "2026-09-12T18:35:00+02:00" },
    ] }));
    expect(resultado.dias["2026-09-12"]).toMatchObject({ peso: 79.3, pasos: 8123, suenoMinutos: 450, entrenamientoMinutos: 35 });
  });

  it("acepta CSV por tipo de archivo", () => {
    const resultado = interpretarHealthConnectCsv("startTime,count,source\n2026-09-10T08:00:00+02:00,6321,Pixel", "Steps.csv");
    expect(resultado.dias["2026-09-10"].pasos).toBe(6321);
  });
});

describe("fusión segura de salud", () => {
  it("conserva comidas, hábitos y métricas manuales por defecto", () => {
    const estado = {
      perfil: { ...PERFIL_DEFECTO },
      dias: { "2026-09-14": { fecha: "2026-09-14", habitos: { agua: true }, pasos: 9000, comidas: [{ id: "a", tipo: "comida" as const, texto: "Arroz", kcal: 300, proteinas: 8, carbohidratos: 60, grasas: 3 }] } },
      composicion: [{ fecha: "2026-09-14", peso: 80 }],
    };
    const importacion = {
      fuente: "health-connect" as const,
      registrosLeidos: 4,
      desde: "2026-09-14",
      hasta: "2026-09-14",
      avisos: [],
      dias: { "2026-09-14": { fecha: "2026-09-14", peso: 79, pasos: 7000, suenoMinutos: 480, entrenamientoMinutos: 30 } },
    };
    const resultado = prepararImportacionSalud(importacion, estado, { peso: true, pasos: true, sueno: true, entrenamiento: true }, true);
    expect(resultado.datos.dias?.["2026-09-14"]).toMatchObject({ habitos: { agua: true }, pasos: 9000, suenoMinutos: 480, entrenamientoMinutos: 30 });
    expect(resultado.datos.dias?.["2026-09-14"].comidas).toHaveLength(1);
    expect(resultado.datos.composicion).toEqual([]);
    expect(resultado.resumen).toMatchObject({ dias: 1, sueno: 1, entrenamiento: 1, omitidos: 2 });
  });
});
