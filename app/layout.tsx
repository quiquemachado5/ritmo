import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { bricolage, hanken } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { WebVitals } from "@/components/app/web-vitals";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RITMO — constancia sobre perfección",
    template: "%s · RITMO",
  },
  description:
    "Seguimiento de nutrición, peso, hábitos y progreso. RITMO convierte tu constancia diaria en una predicción honesta de tu evolución.",
  applicationName: "RITMO",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ritmo.app"),
  // App personal: que ningún buscador la indexe.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      {
        url: "/icon",
        type: "image/png",
      },
    ],
    apple: "/apple-icon",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "RITMO",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    title: "RITMO — constancia sobre perfección",
    description: "Seguimiento de nutrición, peso, hábitos y progreso.",
    siteName: "RITMO",
  },
  twitter: {
    card: "summary_large_image",
    title: "RITMO",
    description: "Nutrición, peso y hábitos. Constancia sobre perfección.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0f120f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // La CSP usa un nonce distinto por respuesta; Next necesita render dinámico
  // para adjuntarlo también a sus scripts internos.
  await connection();
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${hanken.variable} ${bricolage.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <WebVitals />
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
