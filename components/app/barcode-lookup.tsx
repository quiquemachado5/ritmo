"use client";

import * as React from "react";
import { Camera, Check, Loader2, ScanBarcode, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeBarcode, scaleBarcodeProduct, type BarcodeProduct } from "@/lib/nutrition/barcode";

interface DetectedBarcodeLike { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcodeLike[]> }
interface BarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

export function BarcodeLookup({ onUse, onOpenChange }: { onUse: (product: BarcodeProduct, grams: number) => void; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [product, setProduct] = React.useState<BarcodeProduct | null>(null);
  const [grams, setGrams] = React.useState("100");
  const [loading, setLoading] = React.useState(false);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [error, setError] = React.useState("");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanToken = React.useRef(0);
  const requestRef = React.useRef<AbortController | null>(null);
  const cameraAvailable = React.useSyncExternalStore(
    () => () => {},
    () => {
      const media = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices;
      return typeof media?.getUserMedia === "function" && "BarcodeDetector" in window && window.isSecureContext;
    },
    () => false,
  );

  const amount = Number(grams.replace(",", "."));
  const scaled = React.useMemo(() => {
    if (!product) return null;
    try { return scaleBarcodeProduct(product, amount); }
    catch { return null; }
  }, [amount, product]);

  const stopCamera = React.useCallback(() => {
    scanToken.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  React.useEffect(() => () => {
    scanToken.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    requestRef.current?.abort();
  }, []);

  async function search(candidate = code) {
    const normalized = normalizeBarcode(candidate);
    setError("");
    setProduct(null);
    if (!normalized) {
      setError("Introduce un código EAN, UPC o GTIN de 8 a 14 dígitos.");
      return;
    }
    setCode(normalized);
    stopCamera();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch("/api/nutricion/codigo", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as { product?: BarcodeProduct; error?: string } | null;
      if (!response.ok || !payload?.product) throw new Error(payload?.error || "No se pudo consultar el producto.");
      setProduct(payload.product);
      setGrams(String(payload.product.servingGrams ?? 100));
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "No se pudo consultar el producto.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function startCamera() {
    setError("");
    setProduct(null);
    try {
      const Constructor = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      const media = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices;
      if (!Constructor || typeof media?.getUserMedia !== "function") throw new Error("Tu navegador no permite leer códigos con la cámara. Puedes escribirlo debajo.");
      const available = Constructor.getSupportedFormats ? await Constructor.getSupportedFormats() : ["ean_13", "ean_8", "upc_a", "upc_e"];
      const formats = ["ean_13", "ean_8", "upc_a", "upc_e"].filter((format) => available.includes(format));
      if (!formats.length) throw new Error("La cámara de este navegador no reconoce códigos de alimentación. Puedes escribirlo debajo.");
      const stream = await media.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((track) => track.stop()); return; }
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);
      const detector = new Constructor({ formats });
      const token = ++scanToken.current;

      const scan = async () => {
        if (scanToken.current !== token || !stream.active) return;
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const detected = await detector.detect(video);
            const found = detected.map((item) => normalizeBarcode(item.rawValue)).find(Boolean);
            if (found) { await search(found); return; }
          }
        } catch {
          setError("No pude enfocar el código. Acércalo, mejora la luz o escríbelo debajo.");
        }
        if (scanToken.current === token) window.setTimeout(scan, 220);
      };
      void scan();
    } catch (reason) {
      stopCamera();
      if (reason instanceof DOMException && reason.name === "NotAllowedError") {
        setError("La cámara no tiene permiso. Puedes habilitarlo en el navegador o escribir el código.");
      } else {
        setError(reason instanceof Error ? reason.message : "No se pudo abrir la cámara. Puedes escribir el código.");
      }
    }
  }

  function close() {
    stopCamera();
    requestRef.current?.abort();
    setOpen(false);
    onOpenChange?.(false);
    setError("");
  }

  if (!open) {
    return <Button type="button" variant="outline" size="sm" className="min-h-11 rounded-xl" onClick={() => { setOpen(true); onOpenChange?.(true); }}><ScanBarcode className="size-4" /> Código de barras</Button>;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Buscar producto por código de barras">
      <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Producto envasado</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Escanea o escribe el código. Revisarás los gramos antes de añadirlo.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={close} aria-label="Cerrar lector"><X className="size-4" /></Button>
      </div>

      <div className={cn("relative aspect-[16/9] max-h-64 overflow-hidden bg-foreground", !cameraActive && "hidden")}>
          <video ref={videoRef} muted playsInline className="size-full object-cover" aria-label="Vista de la cámara para leer el código" />
          <div className="pointer-events-none absolute inset-[20%_12%] rounded-xl border-2 border-primary-foreground/90" aria-hidden="true" />
          <Button type="button" variant="secondary" size="sm" className="absolute bottom-3 left-1/2 -translate-x-1/2" onClick={stopCamera}><Square className="size-3.5 fill-current" /> Parar cámara</Button>
      </div>

      <div className="space-y-3 p-3">
        {!cameraActive && cameraAvailable && <Button type="button" variant="secondary" className="min-h-11 w-full rounded-xl" onClick={() => void startCamera()}><Camera className="size-4" /> Escanear con la cámara</Button>}
        {!cameraAvailable && <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">La lectura directa no está disponible en este navegador. Introduce el número impreso junto al código.</p>}
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <Input
            aria-label="Código EAN, UPC o GTIN"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(event) => { setCode(event.target.value.replace(/[^\d\s-]/g, "").slice(0, 20)); setProduct(null); setError(""); }}
            placeholder="Ej. 8412345678901"
            className="h-11 min-w-0 rounded-xl text-base tabular"
          />
          <Button type="submit" className="h-11 shrink-0 rounded-xl" disabled={loading || !code.trim()}>{loading ? <Loader2 className="size-4 animate-spin" /> : <ScanBarcode className="size-4" />} Buscar</Button>
        </form>
        {error && <p className="text-sm leading-relaxed text-destructive" role="alert">{error}</p>}

        {product && (
          <div className="rounded-xl border border-border bg-secondary/25 p-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{product.name}</p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">{[product.brand, product.servingSize && `ración ${product.servingSize}`].filter(Boolean).join(" · ") || `Código ${product.code}`}</p>
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,9rem)_1fr] items-end gap-3">
              <label className="text-xs font-medium text-muted-foreground">Cantidad consumida
                <span className="mt-1 flex items-center gap-2"><Input aria-label="Cantidad consumida en gramos" value={grams} onChange={(event) => setGrams(event.target.value)} inputMode="decimal" className={cn("h-11 rounded-xl bg-background text-base tabular", grams && !scaled && "border-destructive")} /><span>g</span></span>
              </label>
              <div className="min-w-0 pb-1 text-right text-xs text-muted-foreground">
                <strong className="block font-display text-xl text-energy tabular">{scaled ? `${scaled.kcal} kcal` : "—"}</strong>
                {scaled && <span className="tabular">P {scaled.proteins} · C {scaled.carbohydrates} · G {scaled.fat}</span>}
              </div>
            </div>
            {!scaled && <p className="mt-2 text-xs text-destructive">Indica una cantidad entre 1 y 5.000 g.</p>}
            <Button type="button" className="mt-3 min-h-11 w-full rounded-xl" disabled={!scaled} onClick={() => { if (scaled) { onUse(product, scaled.grams); close(); } }}><Check className="size-4" /> Revisar y añadir</Button>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">Valores por 100 g aportados por la comunidad de Open Food Facts. Compáralos con la etiqueta del envase.</p>
          </div>
        )}
      </div>
    </section>
  );
}
