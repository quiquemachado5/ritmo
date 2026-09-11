import { ImageResponse } from "next/og";

export const alt = "RITMO — constancia sobre perfección";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#F6F7F2",
        color: "#0B2E23",
        padding: "76px 82px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <svg viewBox="0 0 364 94" width="560" height="145">
          <g fill="none" stroke="#1C5B3A" strokeWidth="15.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 84V59C8 41 17 31 31 31" />
            <path d="M62 39V84" />
            <path d="M100 9.5C97.5 15.5 96 21 96 29V59C96 74 104 81 122 81C140 81 153 41 169 41C184 41 193 70 205 70C217 70 227 41 242 41C257 41 266 82 279 83" />
            <path d="M96 31H126" />
            <circle cx="62" cy="9.5" r="8.8" fill="#1C5B3A" stroke="none" />
            <circle cx="329" cy="58.5" r="26.5" />
          </g>
          <path d="M273.5 75.3C281 79 286.5 86 294 90C286.5 91.6 279 91 272.8 88.2Z" fill="#1C5B3A" />
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700, letterSpacing: "-1.5px" }}>Constancia sobre perfección.</div>
          <div style={{ display: "flex", fontSize: 25, color: "#53635A" }}>Nutrición, hábitos y progreso que sí se entienden.</div>
        </div>
        <div style={{ width: 132, height: 132, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#1C5B3A" }}>
          <svg viewBox="0 0 128 128" width="112" height="112">
            <path d="M18 76C31 76 38 42 52 42C66 42 72 76 84 76C97 76 103 42 112 42" fill="none" stroke="#F6F7F2" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>,
    size,
  );
}
