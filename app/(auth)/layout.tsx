import Link from "next/link";
import { RitmoLogo } from "@/components/ritmo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-atmosphere relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-4">
        <div aria-hidden="true" className="auth-orb auth-orb-one" />
        <div aria-hidden="true" className="auth-orb auth-orb-two" />
        <div aria-hidden="true" className="auth-grain" />
        <div className="mb-4 relative z-10">
          <Link href="/" aria-label="RITMO">
            <RitmoLogo />
          </Link>
        </div>
        <div className="w-full max-w-md relative z-10">{children}</div>
        <p className="mt-4 text-center text-[0.6rem] text-muted-foreground/50 relative z-10">
          hecho por{" "}
          <a href="https://github.com/quiquemachado5" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline">
            quiquemachado5
          </a>
        </p>
      </div>
  );
}
