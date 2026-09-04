"use client";

import * as React from "react";
import { SharePreview, type ShareOptions } from "./share-preview";

export function WeeklyShare({ adherencia, comidas, dias, titulo }: { adherencia: number; comidas: number; dias: number; titulo: string }) {
  const render = React.useCallback(async (opciones: ShareOptions) => {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 630;
    const c = canvas.getContext("2d"); if (!c) return null;
    c.fillStyle = "#f7f5ef"; c.fillRect(0, 0, 1200, 630);
    c.fillStyle = "#1f6b53"; c.fillRect(0, 0, 26, 630);
    c.fillStyle = "#201e18"; c.font = "700 70px Arial"; c.fillText("RITMO", 90, 120);
    c.fillStyle = "#6b6453"; c.font = "400 30px Arial"; c.fillText(titulo, 90, 175);
    c.fillStyle = "#1f6b53"; c.font = "700 190px Arial"; c.fillText(opciones.habitos ? `${adherencia}%` : `${dias}/7`, 90, 390);
    c.fillStyle = "#6b6453"; c.font = "400 32px Arial"; c.fillText(opciones.habitos ? "constancia semanal" : "días con registro", 95, 440);
    c.fillStyle = "#ece9df"; c.fillRect(690, 190, 380, 240);
    c.fillStyle = "#201e18"; c.font = "700 48px Arial"; c.fillText(opciones.comidas ? `${comidas}` : "A mi ritmo", 740, 285); c.font = "400 26px Arial"; c.fillText(opciones.comidas ? "comidas registradas" : "Cada día cuenta", 740, 325);
    c.font = "700 48px Arial"; c.fillText(`${dias}/7`, 740, 380); c.font = "400 26px Arial"; c.fillText("días con datos", 740, 415);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }, [adherencia, comidas, dias, titulo]);
  return <SharePreview render={render} title="Mi semana en RITMO" filename="ritmo-semana.png" />;
}
