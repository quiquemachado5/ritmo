/** Dibuja el wordmark oficial en exportaciones generadas íntegramente en el dispositivo. */
export function dibujarWordmarkRitmo(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  color: string,
) {
  const escala = ancho / 364;
  contexto.save();
  contexto.translate(x, y);
  contexto.scale(escala, escala);
  contexto.strokeStyle = color;
  contexto.fillStyle = color;
  contexto.lineWidth = 15.5;
  contexto.lineCap = "round";
  contexto.lineJoin = "round";

  for (const trazado of [
    "M8 84V59C8 41 17 31 31 31",
    "M62 39V84",
    "M100 9.5C97.5 15.5 96 21 96 29V59C96 74 104 81 122 81C140 81 153 41 169 41C184 41 193 70 205 70C217 70 227 41 242 41C257 41 266 82 279 83",
    "M96 31H126",
  ]) contexto.stroke(new Path2D(trazado));

  contexto.beginPath();
  contexto.arc(62, 9.5, 8.8, 0, Math.PI * 2);
  contexto.fill();
  contexto.beginPath();
  contexto.arc(329, 58.5, 26.5, 0, Math.PI * 2);
  contexto.stroke();
  contexto.fill(new Path2D("M273.5 75.3C281 79 286.5 86 294 90C286.5 91.6 279 91 272.8 88.2Z"));
  contexto.restore();
}
