import Link from "next/link";
import { RitmoLogo } from "@/components/ritmo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-4">
      <div className="mb-4">
        <Link href="/" aria-label="RITMO">
          <RitmoLogo size={28} />
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-4 text-center text-[0.6rem] text-muted-foreground/50">
        hecho por{" "}
        <a href="https://github.com/quiquemachado5" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline">
          quiquemachado5
        </a>
      </p>
    </div>
  );
}
