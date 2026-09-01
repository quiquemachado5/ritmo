"use client";

import * as React from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { habitosModelo } from "@/lib/model/config";
import type { ResumenMes } from "@/lib/model/analytics";
import type { Estado } from "@/lib/model/types";

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.closePath();
}

function texto(c: CanvasRenderingContext2D, value: string, x: number, y: number, max = 860) {
  const palabras = value.split(" "); let linea = ""; let altura = y;
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (c.measureText(candidata).width > max && linea) { c.fillText(linea, x, altura); linea = palabra; altura += 38; }
    else linea = candidata;
  }
  if (linea) c.fillText(linea, x, altura);
  return altura;
}

export function MonthlyShare({ meses, estado }: { meses: ResumenMes[]; estado: Estado }) {
  const [clave, setClave] = React.useState(meses[0]?.clave ?? "");
  const mes = meses.find((m) => m.clave === clave) ?? meses[0];
  if (!mes) return null;

  async function compartir() {
    const dias = Object.values(estado.dias).filter((d) => d.fecha.startsWith(`${mes.clave}-`));
    const porHabito = habitosModelo(estado.perfil).map((h) => ({ etiqueta: h.etiqueta, pct: dias.length ? Math.round((dias.filter((d) => d.habitos?.[h.clave]).length / dias.length) * 100) : 0 }));
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = Math.max(1350, 990 + porHabito.length * 52 + 100);
    const c = canvas.getContext("2d"); if (!c) return;
    c.fillStyle = "#f7f5ef"; c.fillRect(0, 0, 1080, 1350);
    c.fillStyle = "#1f6b53"; c.fillRect(0, 0, 1080, 24);
    c.fillStyle = "#1f6b53"; c.font = "700 52px Bricolage Grotesque, Arial"; c.fillText("RITMO", 82, 110);
    c.fillStyle = "#6b6453"; c.font = "500 30px Hanken Grotesk, Arial"; c.fillText("Mi mes en movimiento", 82, 156);
    c.fillStyle = "#201e18"; c.font = "700 80px Bricolage Grotesque, Arial"; c.fillText(mes.etiqueta.toUpperCase(), 82, 260);
    c.fillStyle = "#e7f1eb"; rounded(c, 82, 315, 916, 320, 28); c.fill();
    c.fillStyle = "#1f6b53"; c.font = "700 190px Bricolage Grotesque, Arial"; c.fillText(`${mes.adherenciaMedia}%`, 130, 510);
    c.font = "600 31px Hanken Grotesk, Arial"; c.fillText("de constancia", 137, 560);
    c.fillStyle = "#1a5642"; c.font = "500 27px Hanken Grotesk, Arial";
    texto(c, mes.adherenciaMedia >= 85 ? "Un mes muy sólido. Esta consistencia deja huella." : mes.adherenciaMedia >= 55 ? "Has construido una base. El siguiente mes puede ser aún más estable." : "Cada día cuenta: el próximo registro es una nueva oportunidad.", 137, 605, 760);

    const metricas = [
      { valor: `${mes.diasRegistrados}`, etiqueta: "días registrados" },
      { valor: `${mes.comidasRegistradas}`, etiqueta: "comidas" },
      { valor: mes.cambioPeso === null ? "—" : `${mes.cambioPeso > 0 ? "+" : ""}${mes.cambioPeso.toFixed(1)}`, etiqueta: mes.cambioPeso === null ? "sin dos pesajes" : "kg en el mes" },
    ];
    metricas.forEach((m, i) => {
      const x = 82 + i * 306; c.fillStyle = "#fffefb"; rounded(c, x, 690, 286, 150, 22); c.fill();
      c.fillStyle = "#201e18"; c.font = "700 52px Bricolage Grotesque, Arial"; c.fillText(m.valor, x + 30, 758);
      c.fillStyle = "#6b6453"; c.font = "500 22px Hanken Grotesk, Arial"; c.fillText(m.etiqueta, x + 30, 802);
    });
    c.fillStyle = "#201e18"; c.font = "700 42px Bricolage Grotesque, Arial"; c.fillText("Lo que sostuve", 82, 935);
    porHabito.forEach((h, i) => {
      const y = 990 + i * 52; c.fillStyle = "#6b6453"; c.font = "500 23px Hanken Grotesk, Arial"; c.fillText(h.etiqueta, 82, y);
      c.fillStyle = "#e5e0d4"; rounded(c, 420, y - 20, 470, 16, 8); c.fill();
      c.fillStyle = h.pct >= 80 ? "#1f6b53" : h.pct >= 45 ? "#9a6b16" : "#b3452c"; rounded(c, 420, y - 20, 470 * (h.pct / 100), 16, 8); c.fill();
      c.fillStyle = "#201e18"; c.font = "700 22px Hanken Grotesk, Arial"; c.textAlign = "right"; c.fillText(`${h.pct}%`, 970, y); c.textAlign = "left";
    });
    c.fillStyle = "#6b6453"; c.font = "500 21px Hanken Grotesk, Arial"; c.fillText("Constancia sobre perfección · ritmo", 82, canvas.height - 48);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob) return;
    const file = new File([blob], `ritmo-${mes.clave}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: `Mi ${mes.etiqueta} en RITMO`, files: [file] }); return; }
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="flex items-center gap-1.5"><select aria-label="Mes para compartir" value={mes.clave} onChange={(e) => setClave(e.target.value)} className="h-8 max-w-28 rounded-lg border border-border bg-card px-2 text-xs font-medium text-foreground"><option value={mes.clave}>{mes.etiqueta}</option>{meses.filter((m) => m.clave !== mes.clave).map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}</select><Button variant="secondary" size="sm" onClick={() => void compartir()} aria-label="Compartir informe mensual" title="Compartir informe mensual" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"><Share2 className="size-3.5" /> <span className="hidden sm:inline">Informe</span></Button></div>;
}
