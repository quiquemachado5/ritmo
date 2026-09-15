"use client";

import { useEffect } from "react";
import { registrarDiagnostico } from "@/lib/observability";

// El layout raíz (tema, fuentes o proveedores) también puede fallar. Esta
// recuperación funciona sin ninguno de esos proveedores ni hojas de estilo.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    registrarDiagnostico("ui", "error", "fallo del layout raíz");
  }, []);

  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#f7f5ef", color: "#201e18", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px", boxSizing: "border-box" }}>
          <div style={{ maxWidth: "440px" }}>
            <p style={{ color: "#1c5b3a", fontWeight: 800, fontSize: "24px" }}>RITMO</p>
            <h1 style={{ fontSize: "28px", lineHeight: 1.2 }}>No pudimos abrir la aplicación</h1>
            <p style={{ color: "#6b6453", lineHeight: 1.6 }}>Ha ocurrido un error al cargar RITMO. Vuelve a intentarlo; si continúa, recarga la página.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "24px" }}>
              <button onClick={reset} style={{ minHeight: "44px", border: 0, borderRadius: "10px", padding: "12px 20px", font: "inherit", fontWeight: 600, background: "#1c5b3a", color: "#f6f7f2", cursor: "pointer" }}>Reintentar</button>
              <button onClick={() => window.location.reload()} style={{ minHeight: "44px", border: "1px solid #6b6453", borderRadius: "10px", padding: "12px 20px", font: "inherit", fontWeight: 600, background: "transparent", color: "#201e18", cursor: "pointer" }}>Recargar página</button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
