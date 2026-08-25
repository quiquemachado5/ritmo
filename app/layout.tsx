import type { Metadata, Viewport } from "next";
import { bricolage, hanken } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect fill='%231f6b53' width='48' height='48' rx='10'/><text x='50%' y='50%' font-size='32' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>R</text></svg>",
        type: "image/svg+xml",
      },
    ],
    apple: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'><rect fill='%231f6b53' width='180' height='180' rx='40'/><text x='90' y='90' font-size='100' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>R</text></svg>",
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
    images: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 630'><rect fill='%231f6b53' width='1200' height='630'/><text x='600' y='315' font-size='120' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>RITMO</text></svg>",
        width: 1200,
        height: 630,
        alt: "RITMO",
      },
    ],
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
