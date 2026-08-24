"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = React.useState(false);
  React.useEffect(() => setMontado(true), []);

  // Hasta el montaje no conocemos el tema resuelto: mantenemos un estado estable
  // para que el HTML del servidor y el del cliente coincidan.
  const oscuro = montado && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      suppressHydrationWarning
      aria-label={oscuro ? "Activar modo claro" : "Activar modo oscuro"}
      onClick={() => setTheme(oscuro ? "light" : "dark")}
      className="rounded-full text-muted-foreground hover:text-foreground"
    >
      {oscuro ? <Sun className="size-[1.15rem]" /> : <Moon className="size-[1.15rem]" />}
    </Button>
  );
}
