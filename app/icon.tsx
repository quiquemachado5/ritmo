import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export default async function Icon() {
  const png = await readFile(join(process.cwd(), "public/brand/ritmo-wordmark-transparent.png"));
  return new ImageResponse(<div style={{ width: "100%", height: "100%", background: "#f7f5ef", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 96 }}>
    {/* El icono utiliza la imagen aprobada; no redibuja sus letras. */}
    <img src={`data:image/png;base64,${png.toString("base64")}`} alt="RITMO" width={400} height={148} style={{ objectFit: "contain" }} />
  </div>, size);
}
