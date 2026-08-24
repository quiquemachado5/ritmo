import Link from "next/link";
import { RitmoLogo } from "@/components/ritmo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8">
        <Link href="/" aria-label="RITMO">
          <RitmoLogo />
        </Link>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 max-w-xs text-center text-xs text-muted-foreground">
        Constancia sobre perfección.
      </p>
      <p className="mt-3 text-center text-[0.65rem] text-muted-foreground/60">
        hecho por{" "}
        <a href="https://github.com/quiquemachado5" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline">
          quiquemachado5
        </a>
      </p>
    </div>
  );
}
