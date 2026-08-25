"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { transitionCSS, springBezier } from "@/lib/transitions";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      <style>{transitionCSS}</style>
      <div
        style={{
          animation: `pageIn 0.5s ${springBezier} forwards`,
        }}
        className="w-full"
      >
        {children}
      </div>
    </>
  );
}
