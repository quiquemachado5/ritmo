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
        <div className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background: "linear-gradient(-45deg, #16a34a 0%, #22c55e 25%, #1f6e47 50%, #2d5a4a 75%, #16a34a 100%)",
            backgroundSize: "400% 400%",
            animation: "gradientShift 25s ease infinite",
            opacity: 0.15,
          }}
        />
        <div className="absolute inset-0 -z-10"
          style={{
            background: "radial-gradient(circle at 20% 40%, rgba(34, 197, 94, 0.12) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(22, 163, 74, 0.1) 0%, transparent 50%)",
          }}
        />
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
