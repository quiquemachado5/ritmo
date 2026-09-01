"use client";

import { usePathname } from "next/navigation";
import { springBezier } from "@/lib/transitions";

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageTransitionStyles = `
  @keyframes pageInCustom {
    0% { opacity: 0; transform: translateY(16px); filter: blur(4px); }
    100% { opacity: 1; transform: translateY(0); filter: blur(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .page-transition { animation: none !important; }
  }
`;

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <>
      <style>{pageTransitionStyles}</style>
      <div
        key={pathname}
        style={{
          animation: `pageInCustom 0.4s ${springBezier} forwards`,
        }}
        className="page-transition w-full"
      >
        {children}
      </div>
    </>
  );
}
