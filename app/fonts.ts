import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";

/** Display / marca / cifras — con personalidad, editorial. */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

/** Cuerpo / interfaz — humanista, cálida, muy legible. */
export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
