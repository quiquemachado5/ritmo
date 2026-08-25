import { redirect } from "next/navigation";

/** Cuerpo forma parte de la lectura de Progreso; se conserva esta ruta para enlaces existentes. */
export default function CuerpoPage() {
  redirect("/progreso#composicion");
}
