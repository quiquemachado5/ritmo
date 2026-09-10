"use client";

import * as React from "react";
import { SharePreview, type ShareOptions } from "./share-preview";
import { habitosModelo } from "@/lib/model/config";
import type { Estado } from "@/lib/model/types";

function caja(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radio: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radio); c.fill();
}

export function AnnualShare({ estado }: { estado: Estado }) {
  const anos = React.useMemo(() => [...new Set([...Object.keys(estado.dias), ...estado.composicion.map((item) => item.fecha)].map((fecha) => fecha.slice(0, 4)))].sort().reverse(), [estado]);
  const [ano, setAno] = React.useState(anos[0] ?? String(new Date().getFullYear()));
  const render = React.useCallback(async (opciones: ShareOptions) => {
    const dias = Object.values(estado.dias).filter((dia) => dia.fecha.startsWith(`${ano}-`));
    const activos = habitosModelo(estado.perfil);
    const observados = dias.filter((dia) => Object.values(dia.habitos || {}).some(Boolean) || dia.comidas?.length || dia.peso != null);
    const perfectos = observados.filter((dia) => activos.every((habito) => dia.habitos?.[habito.clave])).length;
    const adherencia = observados.length ? Math.round(observados.reduce((suma, dia) => suma + activos.filter((habito) => dia.habitos?.[habito.clave]).length / Math.max(1, activos.length), 0) / observados.length * 100) : 0;
    const pesos = [...estado.composicion.map((item) => ({ fecha: item.fecha, peso: item.peso })), ...dias.filter((dia) => dia.peso != null).map((dia) => ({ fecha: dia.fecha, peso: dia.peso! }))].filter((item) => item.fecha.startsWith(`${ano}-`)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const cambio = pesos.length > 1 ? Math.round((pesos[pesos.length - 1].peso - pesos[0].peso) * 10) / 10 : null;
    const mejor = activos.map((habito) => ({ etiqueta: habito.etiqueta, hechos: observados.filter((dia) => dia.habitos?.[habito.clave]).length })).sort((a, b) => b.hechos - a.hechos)[0];
    const meses = Array.from({ length: 12 }, (_, indice) => {
      const clave = `${ano}-${String(indice + 1).padStart(2, "0")}`;
      const filas = observados.filter((dia) => dia.fecha.startsWith(clave));
      const valor = filas.length ? Math.round(filas.reduce((suma, dia) => suma + activos.filter((habito) => dia.habitos?.[habito.clave]).length / Math.max(1, activos.length), 0) / filas.length * 100) : 0;
      return { valor, dias: filas.length };
    });
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
    const c = canvas.getContext("2d"); if (!c) return null;
    c.fillStyle = "#f7f5ef"; c.fillRect(0, 0, 1080, 1350);
    caja(c, 0, 0, 1080, 365, 0, "#165c47");
    c.fillStyle = "#f7f5ef"; c.font = "700 52px Bricolage Grotesque, Arial"; c.fillText("RITMO", 72, 90);
    c.fillStyle = "#b9d8ca"; c.font = "600 23px Hanken Grotesk, Arial"; c.fillText("MI AÑO EN MOVIMIENTO", 72, 137);
    c.fillStyle = "#f7f5ef"; c.font = "700 150px Bricolage Grotesque, Arial"; c.fillText(ano, 68, 302);
    c.fillStyle = "#201e18"; c.font = "700 47px Bricolage Grotesque, Arial"; c.fillText(observados.length ? `Construí ritmo durante ${observados.length} días.` : "Este año empieza con el próximo paso.", 72, 455);
    c.fillStyle = "#6b6453"; c.font = "500 25px Hanken Grotesk, Arial"; c.fillText(perfectos ? `${perfectos} de ellos fueron días completos.` : "La constancia se construye sin exigir perfección.", 72, 500);
    const metricas = [
      opciones.habitos ? [`${adherencia}%`, "constancia"] : [`${observados.length}`, "días con datos"],
      [`${perfectos}`, "días perfectos"],
      opciones.peso && cambio != null ? [`${cambio > 0 ? "+" : ""}${cambio.toFixed(1)} kg`, "cambio medido"] : [mejor?.etiqueta ?? "A mi ritmo", mejor ? `${mejor.hechos} días · hábito más sostenido` : "cada día cuenta"],
    ];
    metricas.forEach(([valor, etiqueta], indice) => { const x = 72 + indice * 320; caja(c, x, 570, 296, 170, 24, indice === 0 ? "#e4f1eb" : "#fffefb"); c.fillStyle = "#173d31"; c.font = `700 ${valor.length > 12 ? 29 : 50}px Bricolage Grotesque, Arial`; c.fillText(valor, x + 25, 645); c.fillStyle = "#6b6453"; c.font = "500 20px Hanken Grotesk, Arial"; c.fillText(etiqueta, x + 25, 694); });
    c.fillStyle = "#201e18"; c.font = "700 34px Bricolage Grotesque, Arial"; c.fillText("Doce meses, una misma dirección", 72, 825);
    meses.forEach((mes, indice) => { const x = 72 + (indice % 6) * 154; const y = 875 + Math.floor(indice / 6) * 148; const color = mes.dias === 0 ? "#ebe7dd" : mes.valor >= 80 ? "#b9dfcc" : mes.valor >= 50 ? "#e8d49e" : "#e6b0a3"; caja(c, x, y, 136, 118, 20, color); c.fillStyle = "#173d31"; c.font = "700 28px Bricolage Grotesque, Arial"; c.fillText(mes.dias ? `${mes.valor}%` : "—", x + 18, y + 52); c.fillStyle = "#6b6453"; c.font = "600 17px Hanken Grotesk, Arial"; c.fillText(new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(Number(ano), indice, 1)), x + 18, y + 85); });
    c.fillStyle = "#6b6453"; c.font = "500 21px Hanken Grotesk, Arial"; c.fillText("Generado de forma privada en tu dispositivo · ritmo", 72, 1302);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }, [ano, estado]);

  if (anos.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-2"><select aria-label="Año del resumen" value={ano} onChange={(evento) => setAno(evento.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground">{anos.map((item) => <option key={item} value={item}>{item}</option>)}</select><SharePreview render={render} filename={`ritmo-${ano}-wrapped.png`} title={`Mi ${ano} en RITMO`} triggerLabel="Resumen anual" monthly /></div>;
}
