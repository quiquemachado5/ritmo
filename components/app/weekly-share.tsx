"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WeeklyShare({ adherencia, comidas, dias, titulo }: { adherencia: number; comidas: number; dias: number; titulo: string }) {
  async function compartir() {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 630;
    const c = canvas.getContext("2d"); if (!c) return;
    c.fillStyle = "#f7f5ef"; c.fillRect(0, 0, 1200, 630);
    c.fillStyle = "#1f6b53"; c.fillRect(0, 0, 26, 630);
    c.fillStyle = "#201e18"; c.font = "700 70px Arial"; c.fillText("RITMO", 90, 120);
    c.fillStyle = "#6b6453"; c.font = "400 30px Arial"; c.fillText(titulo, 90, 175);
    c.fillStyle = "#1f6b53"; c.font = "700 190px Arial"; c.fillText(`${adherencia}%`, 90, 390);
    c.fillStyle = "#6b6453"; c.font = "400 32px Arial"; c.fillText("constancia semanal", 95, 440);
    c.fillStyle = "#ece9df"; c.fillRect(690, 190, 380, 240);
    c.fillStyle = "#201e18"; c.font = "700 48px Arial"; c.fillText(`${comidas}`, 740, 285); c.font = "400 26px Arial"; c.fillText("comidas registradas", 740, 325);
    c.font = "700 48px Arial"; c.fillText(`${dias}/7`, 740, 380); c.font = "400 26px Arial"; c.fillText("días con datos", 740, 415);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob) return;
    const file = new File([blob], "ritmo-semana.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: "Mi semana en RITMO", files: [file] }); return; }
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "ritmo-semana.png"; a.click(); URL.revokeObjectURL(url);
  }
  return <Button variant="secondary" size="sm" onClick={() => void compartir()} className="gap-2"><Share2 className="size-3.5" /> Compartir</Button>;
}
