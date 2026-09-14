"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SnapRailProps = {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
  desktopStatic?: boolean;
};

export function SnapRail({ children, ariaLabel, className, itemClassName, desktopStatic = true }: SnapRailProps) {
  const items = React.Children.toArray(children);
  const railRef = React.useRef<HTMLUListElement>(null);
  const [active, setActive] = React.useState(0);

  const irA = React.useCallback((index: number) => {
    const target = Math.max(0, Math.min(items.length - 1, index));
    const node = railRef.current?.children.item(target) as HTMLElement | null;
    node?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActive(target);
  }, [items.length]);

  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Array.from(rail.children).indexOf(visible.target);
      if (index >= 0) setActive(index);
    }, { root: rail, threshold: [0.55, 0.8] });
    Array.from(rail.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [items.length]);

  return (
    <section className={cn("min-w-0", className)} aria-label={ariaLabel}>
      <ul
        ref={railRef}
        tabIndex={0}
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          desktopStatic && "lg:mr-0 lg:grid lg:overflow-visible lg:pr-0",
        )}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") { event.preventDefault(); irA(active + 1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); irA(active - 1); }
          if (event.key === "Home") { event.preventDefault(); irA(0); }
          if (event.key === "End") { event.preventDefault(); irA(items.length - 1); }
        }}
      >
        {items.map((item, index) => (
          <li key={index} className={cn("w-[calc(100%-2.75rem)] shrink-0 snap-start", desktopStatic && "lg:w-auto", itemClassName)}>
            {item}
          </li>
        ))}
      </ul>
      {items.length > 1 && (
        <div className={cn("mt-2 flex justify-center gap-1.5", desktopStatic && "lg:hidden")} aria-label={`Página ${active + 1} de ${items.length}`}>
          {items.map((_, index) => (
            <button key={index} type="button" onClick={() => irA(index)} className={cn("h-1.5 rounded-full transition-[width,background-color]", active === index ? "w-5 bg-primary" : "w-1.5 bg-border")} aria-label={`Mostrar panel ${index + 1}`} aria-current={active === index ? "true" : undefined} />
          ))}
        </div>
      )}
    </section>
  );
}
