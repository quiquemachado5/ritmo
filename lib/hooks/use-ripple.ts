import { useCallback } from "react";
import { transitionCSS } from "@/lib/transitions";

export function useRipple() {
  const addRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement("span");
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    ripple.className = "ripple";

    button.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  }, []);

  return { addRipple };
}

export const rippleStyles = `
  ${transitionCSS}

  [data-ripple] {
    position: relative;
    overflow: hidden;
  }

  .ripple {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
    transform: scale(0);
    animation: ripple 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }
`;
