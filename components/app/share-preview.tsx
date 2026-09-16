"use client";

import * as React from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ShareOptions { peso: boolean; comidas: boolean; habitos: boolean; formato: "poster" | "detalle" }
export function SharePreview({ render, filename, title, monthly = false, triggerLabel }: {
  render: (options: ShareOptions) => Promise<Blob | null>; filename: string; title: string; monthly?: boolean; triggerLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ShareOptions>({ peso: false, comidas: false, habitos: true, formato: "poster" });
  const [preview, setPreview] = React.useState<{ url: string; blob: Blob } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    let active = true; let url: string | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setPreview(null);
    void document.fonts.ready.then(() => render(options)).then(blob => {
      if (!active || !blob) return;
      url = URL.createObjectURL(blob); setPreview({ url, blob });
    }).catch(() => toast.error("No se pudo preparar la imagen. Inténtalo de nuevo.")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [open, options, render]);
  async function compartir() {
    if (!preview || loading || sharing) return;
    setSharing(true);
    try {
      const file = new File([preview.blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ title, files: [file] });
      else descargar();
    } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("No se pudo compartir. Puedes descargar la imagen."); }
    finally { setSharing(false); }
  }
  function descargar() {
    if (!preview || loading) return;
    const a = document.createElement("a"); a.href = preview.url; a.download = filename; a.click();
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={triggerLabel ? `Preparar ${triggerLabel.toLocaleLowerCase("es-ES")}` : monthly ? "Preparar informe mensual" : "Preparar resumen semanal"} className="min-h-10 border-border/80 bg-card px-3 shadow-none hover:bg-secondary/45">{triggerLabel ?? (monthly ? "Informe" : "Compartir")}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-4 overflow-hidden sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Elige qué mostrar. No se incluye tu nombre, correo ni notas personales.</DialogDescription></DialogHeader>
        {monthly && <div className="grid grid-cols-2 rounded-xl bg-secondary p-1" role="group" aria-label="Formato de la imagen">{([['poster', 'Póster editorial'], ['detalle', 'Informe visual']] as const).map(([valor, etiqueta]) => <button key={valor} type="button" aria-pressed={options.formato === valor} onClick={() => setOptions(actual => ({ ...actual, formato: valor }))} className={cn("min-h-9 rounded-lg px-3 text-sm font-medium transition-colors", options.formato === valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{etiqueta}</button>)}</div>}
        <div className="flex flex-wrap gap-x-5 gap-y-3 border-y border-border py-3">
          {([...(monthly ? [["peso", "Evolución de peso"]] : []), ["comidas", "Número de comidas"], ["habitos", "Constancia"]] as Array<["peso" | "comidas" | "habitos", string]>).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><Switch checked={options[key]} onCheckedChange={checked => setOptions(o => ({ ...o, [key]: checked }))} aria-label={label} />{label}</label>)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-secondary p-3" aria-busy={loading}>
          {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="size-6 motion-safe:animate-spin" aria-label="Preparando imagen" /></div> : preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={`Vista previa de ${title}`} className="mx-auto h-auto max-h-[52dvh] w-auto max-w-full rounded-lg" />
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={loading || !preview} onClick={descargar}><Download className="size-4" />Descargar imagen</Button><Button disabled={loading || !preview || sharing} onClick={() => void compartir()}><Share2 className="size-4" />{sharing ? "Compartiendo…" : "Compartir"}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
