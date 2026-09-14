import Link from "next/link";
import { RitmoLogo } from "@/components/ritmo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-atmosphere relative flex min-h-dvh flex-col items-center justify-start overflow-x-hidden bg-background px-4 py-5 sm:justify-center sm:py-8">
        <div aria-hidden="true" className="auth-orb auth-orb-one" />
        <div aria-hidden="true" className="auth-orb auth-orb-two" />
        <div aria-hidden="true" className="auth-grain" />
        <div className="relative z-10 mb-5 shrink-0 sm:mb-4">
          <Link href="/" aria-label="RITMO">
            <RitmoLogo />
          </Link>
        </div>
        <div className="relative z-10 w-full max-w-md">{children}</div>
        <p className="relative z-10 mt-4 text-center text-xs text-muted-foreground">Para mayores de 18 años · <Link href="/privacidad" className="underline underline-offset-4">Tus datos y privacidad</Link></p>
        <p className="relative z-10 mt-5 shrink-0 text-center text-[0.65rem] text-muted-foreground/55">
          hecho por{" "}
          <a href="https://github.com/quiquemachado5" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline">
            quiquemachado5
          </a>
        </p>
      </main>
  );
}
