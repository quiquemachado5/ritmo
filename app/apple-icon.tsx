import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1C5B3A",
      }}
    >
      <svg viewBox="0 0 128 128" width="180" height="180">
        <path
          d="M18 76C31 76 38 42 52 42C66 42 72 76 84 76C97 76 103 42 112 42"
          fill="none"
          stroke="#F6F7F2"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    size,
  );
}
