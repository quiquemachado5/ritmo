import Link from "next/link";
import { RitmoLogo } from "@/components/ritmo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const bgGradient = `
    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
  `;

  return (
    <>
      <style>{bgGradient}</style>
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-4 relative overflow-hidden bg-background">
        {/* Animated gradient background */}
        <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none"
          style={{
            background: "linear-gradient(-45deg, var(--color-primary-light), var(--color-primary), var(--color-primary-dark))",
            backgroundSize: "400% 400%",
            animation: "gradientShift 15s ease infinite",
          }}
        />
        <div className="absolute inset-0 -z-10 backdrop-blur-3xl"></div>
        <div className="mb-4 relative z-10">
          <Link href="/" aria-label="RITMO">
            <RitmoLogo size={28} />
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
    </>
  );
}
