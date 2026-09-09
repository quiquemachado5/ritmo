import {
  Flame,
  FlaskConical,
  Home,
  Minimize2,
  Settings,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece en la barra inferior móvil. */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoy", icon: Home, primary: true },
  { href: "/nutricion", label: "Nutrición", icon: UtensilsCrossed, primary: true },
  { href: "/habitos", label: "Hábitos", icon: Flame, primary: true },
  { href: "/progreso", label: "Progreso", icon: TrendingUp, primary: true },
  { href: "/ajustes", label: "Ajustes", icon: Settings, primary: false },
  { href: "/minimo", label: "Modo mínimo", icon: Minimize2, primary: false },
  { href: "/laboratorio", label: "Laboratorio", icon: FlaskConical, primary: false },
];
