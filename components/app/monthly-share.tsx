"use client";

import * as React from "react";
import { SharePreview, type ShareOptions } from "./share-preview";
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
  const render = React.useCallback(async (opciones: ShareOptions) => {
    if (!mes) return null;
    const dias = Object.values(estado.dias).filter((d) => d.fecha.startsWith(`${mes.clave}-`));
    const porHabito = opciones.habitos ? habitosModelo(estado.perfil).map((h) => ({ etiqueta: h.etiqueta, pct: dias.length ? Math.round((dias.filter((d) => d.habitos?.[h.clave]).length / dias.length) * 100) : 0 })) : [];
    const activos = habitosModelo(estado.perfil);
    if (opciones.formato === "poster") {
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
      const c = canvas.getContext("2d"); if (!c) return null;
      c.fillStyle = "#165c47"; c.fillRect(0, 0, 1080, 1350);
      c.fillStyle = "#f7f5ef"; c.font = "700 54px Bricolage Grotesque, Arial"; c.fillText("RITMO", 76, 104);
      c.fillStyle = "#b9d8ca"; c.font = "500 23px Hanken Grotesk, Arial"; c.fillText("CONSTANCIA SOBRE PERFECCIÓN", 76, 145);
      c.fillStyle = "#f7f5ef"; c.font = "700 104px Bricolage Grotesque, Arial"; c.fillText(mes.etiqueta.toUpperCase(), 76, 285);
      c.fillStyle = "#b9d8ca"; c.font = "500 28px Hanken Grotesk, Arial"; c.fillText("Un mes no es una cifra. Es una secuencia.", 80, 332);

      const [anno, numeroMes] = mes.clave.split("-").map(Number);
      const diasMes = new Date(anno, numeroMes, 0).getDate();
      const primero = (new Date(anno, numeroMes - 1, 1).getDay() + 6) % 7;
      const porFecha = new Map(dias.map((dia) => [Number(dia.fecha.slice(-2)), dia]));
      const inicioX = 80; const inicioY = 430; const pasoX = 132; const pasoY = 102;
      ["L", "M", "X", "J", "V", "S", "D"].forEach((letra, i) => { c.fillStyle = "#b9d8ca"; c.font = "600 19px Hanken Grotesk, Arial"; c.textAlign = "center"; c.fillText(letra, inicioX + i * pasoX + 48, 395); });
      for (let dia = 1; dia <= diasMes; dia++) {
        const pos = primero + dia - 1; const x = inicioX + (pos % 7) * pasoX; const y = inicioY + Math.floor(pos / 7) * pasoY;
        const registro = porFecha.get(dia); const hechos = activos.filter((h) => registro?.habitos?.[h.clave]).length; const ratio = activos.length ? hechos / activos.length : 0;
        c.fillStyle = !registro ? "#2a6b59" : ratio >= .83 ? "#d8efe3" : ratio >= .5 ? "#e8cf8d" : ratio > 0 ? "#e99d78" : "#873f35";
        rounded(c, x, y, 96, 78, 22); c.fill();
        c.fillStyle = !registro ? "#78a394" : ratio >= .5 ? "#173d31" : "#fff3e9"; c.font = "700 25px Bricolage Grotesque, Arial"; c.textAlign = "center"; c.fillText(String(dia), x + 48, y + 38);
        c.font = "600 15px Hanken Grotesk, Arial"; c.fillText(registro ? `${hechos}/${activos.length}` : "—", x + 48, y + 65);
      }
      c.textAlign = "left";
      const metricas = [
        opciones.habitos ? { valor: `${mes.adherenciaMedia}%`, etiqueta: "constancia" } : { valor: `${mes.diasRegistrados}`, etiqueta: "días con datos" },
        opciones.comidas ? { valor: `${mes.comidasRegistradas}`, etiqueta: "comidas" } : { valor: `${mes.diasRegistrados}`, etiqueta: "días registrados" },
        opciones.peso && mes.cambioPeso != null ? { valor: `${mes.cambioPeso > 0 ? "+" : ""}${mes.cambioPeso.toFixed(1)} kg`, etiqueta: "cambio medido" } : { valor: "A mi ritmo", etiqueta: "cada día cuenta" },
      ];
      metricas.forEach((metrica, i) => { const x = 76 + i * 318; c.fillStyle = "#f7f5ef"; rounded(c, x, 1080, 292, 150, 24); c.fill(); c.fillStyle = "#173d31"; c.font = `700 ${metrica.valor.length > 9 ? 30 : 48}px Bricolage Grotesque, Arial`; c.fillText(metrica.valor, x + 25, 1145); c.fillStyle = "#607267"; c.font = "500 20px Hanken Grotesk, Arial"; c.fillText(metrica.etiqueta, x + 25, 1190); });
      c.fillStyle = "#b9d8ca"; c.font = "500 20px Hanken Grotesk, Arial"; c.fillText("Generado de forma privada en tu dispositivo · ritmo", 76, 1305);
      return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = Math.max(1350, 990 + porHabito.length * 52 + 100);
    const c = canvas.getContext("2d"); if (!c) return null;
    c.fillStyle = "#f7f5ef"; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#1f6b53"; c.fillRect(0, 0, 1080, 24);
    c.fillStyle = "#1f6b53"; c.font = "700 52px Bricolage Grotesque, Arial"; c.fillText("RITMO", 82, 110);
    c.fillStyle = "#6b6453"; c.font = "500 30px Hanken Grotesk, Arial"; c.fillText("Mi mes en movimiento", 82, 156);
    c.fillStyle = "#201e18"; c.font = "700 80px Bricolage Grotesque, Arial"; c.fillText(mes.etiqueta.toUpperCase(), 82, 260);
    c.fillStyle = "#e7f1eb"; rounded(c, 82, 315, 916, 320, 28); c.fill();
    c.fillStyle = "#1f6b53"; c.font = "700 190px Bricolage Grotesque, Arial"; c.fillText(opciones.habitos ? `${mes.adherenciaMedia}%` : `${mes.diasRegistrados}`, 130, 510);
    c.font = "600 31px Hanken Grotesk, Arial"; c.fillText(opciones.habitos ? "de constancia" : "días con registro", 137, 560);
    c.fillStyle = "#1a5642"; c.font = "500 27px Hanken Grotesk, Arial";
    texto(c, "Mi recorrido, a mi ritmo.", 137, 605, 760);

    const metricas = [
      { valor: `${mes.diasRegistrados}`, etiqueta: "días registrados" },
      ...(opciones.comidas ? [{ valor: `${mes.comidasRegistradas}`, etiqueta: "comidas" }] : []),
      ...(opciones.peso ? [{ valor: mes.cambioPeso === null ? "—" : `${mes.cambioPeso > 0 ? "+" : ""}${mes.cambioPeso.toFixed(1)}`, etiqueta: mes.cambioPeso === null ? "sin dos pesajes" : "kg medidos en el mes" }] : []),
    ];
    metricas.forEach((m, i) => {
      const x = 82 + i * 306; c.fillStyle = "#fffefb"; rounded(c, x, 690, 286, 150, 22); c.fill();
      c.fillStyle = "#201e18"; c.font = "700 52px Bricolage Grotesque, Arial"; c.fillText(m.valor, x + 30, 758);
      c.fillStyle = "#6b6453"; c.font = "500 22px Hanken Grotesk, Arial"; c.fillText(m.etiqueta, x + 30, 802);
    });
    if (opciones.habitos) { c.fillStyle = "#201e18"; c.font = "700 36px Bricolage Grotesque, Arial"; c.fillText("Mis hábitos · sobre días con registro", 82, 935); }
    porHabito.forEach((h, i) => {
      const y = 990 + i * 52; c.fillStyle = "#6b6453"; c.font = "500 23px Hanken Grotesk, Arial"; c.fillText(h.etiqueta, 82, y);
      c.fillStyle = "#e5e0d4"; rounded(c, 420, y - 20, 470, 16, 8); c.fill();
      c.fillStyle = h.pct >= 80 ? "#1f6b53" : h.pct >= 45 ? "#9a6b16" : "#b3452c"; rounded(c, 420, y - 20, 470 * (h.pct / 100), 16, 8); c.fill();
      c.fillStyle = "#201e18"; c.font = "700 22px Hanken Grotesk, Arial"; c.textAlign = "right"; c.fillText(`${h.pct}%`, 970, y); c.textAlign = "left";
    });
    c.fillStyle = "#6b6453"; c.font = "500 21px Hanken Grotesk, Arial"; c.fillText("Constancia sobre perfección · ritmo", 82, canvas.height - 48);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }, [mes, estado]);
  if (!mes) return null;

  return <div className="flex flex-wrap items-center gap-2"><select aria-label="Mes para compartir" value={mes.clave} onChange={(e) => setClave(e.target.value)} className="h-10 max-w-32 rounded-lg border border-border bg-card px-2 text-sm font-medium text-foreground"><option value={mes.clave}>{mes.etiqueta}</option>{meses.filter((m) => m.clave !== mes.clave).map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}</select><SharePreview render={render} filename={`ritmo-${mes.clave}.png`} title={`Mi ${mes.etiqueta} en RITMO`} monthly /></div>;
}
