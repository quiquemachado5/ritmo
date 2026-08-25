"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { transitionCSS, springBezier } from "@/lib/transitions";

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageTransitionStyles = `
  @keyframes pageInCustom {
    0% { opacity: 0; transform: translateY(16px); filter: blur(4px); }
    100% { opacity: 1; transform: translateY(0); filter: blur(0); }
  }
`;

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey(k => k + 1);
  }, [pathname]);

  return (
    <>
      <style>{pageTransitionStyles}</style>
      <div
        key={key}
        style={{
          animation: `pageInCustom 0.4s ${springBezier} forwards`,
        }}
        className="w-full"
      >
        {children}
      </div>
    </>
  );
}
