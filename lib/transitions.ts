export const transitionCSS = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(2px); }
  }

  @keyframes slideUp {
    0% { opacity: 0; transform: translateY(12px); filter: blur(4px); }
    100% { opacity: 1; transform: translateY(0); filter: blur(0); }
  }

  @keyframes fadeScale {
    0% { opacity: 0; transform: scale(0.96); filter: blur(2px); }
    100% { opacity: 1; transform: scale(1); filter: blur(0); }
  }

  @keyframes revealText {
    0% { opacity: 0; clip-path: inset(0 100% 0 0); }
    100% { opacity: 1; clip-path: inset(0 0 0 0); }
  }

  @keyframes successPop {
    0% { opacity: 0; transform: scale(0.5) rotate(-8deg); filter: blur(4px); }
    60% { transform: scale(1.1) rotate(2deg); filter: blur(0); }
    100% { opacity: 1; transform: scale(1) rotate(0); filter: blur(0); }
  }

  @keyframes toastIn {
    0% { opacity: 0; transform: translateY(8px) scale(0.95); filter: blur(3px); }
    100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes drawCheck {
    0% { stroke-dashoffset: 24; }
    100% { stroke-dashoffset: 0; }
  }
`;

export const springBezier = "cubic-bezier(0.34, 1.56, 0.64, 1)";
export const smoothBezier = "cubic-bezier(0.22, 1, 0.36, 1)";
export const shakeBezier = "cubic-bezier(0.36, 0, 0.66, -0.56)";

export function stagger(index: number, base = 0.08) {
  return {
    animation: `slideUp 0.5s ${springBezier} ${index * base}s both`,
  };
}
