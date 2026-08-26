"use client";

import { transitionCSS } from "@/lib/transitions";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  count?: number;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "8px",
  count = 1,
  className = "",
}: SkeletonProps) {
  const skeletons = Array.from({ length: count });

  return (
    <>
      <style>{transitionCSS}</style>
      <div className={`space-y-2 ${className}`}>
        {skeletons.map((_, i) => (
          <div
            key={i}
            style={{
              width,
              height,
              borderRadius,
              background: "linear-gradient(90deg, var(--skeleton-bg) 25%, var(--skeleton-light) 50%, var(--skeleton-bg) 75%)",
              backgroundSize: "200% 100%",
              animation: "skeleton 2s infinite",
              backgroundColor: "hsl(var(--muted))",
            }}
            className="block"
          />
        ))}
      </div>
    </>
  );
}

export function CardSkeleton() {
  return (
    <>
      <style>{transitionCSS}</style>
      <div className="space-y-4">
        <Skeleton height="24px" />
        <div className="space-y-2">
          <Skeleton height="16px" />
          <Skeleton height="16px" width="90%" />
        </div>
        <Skeleton height="12px" width="60%" />
      </div>
    </>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <style>{transitionCSS}</style>
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton width="60px" height="60px" borderRadius="12px" />
            <div className="flex-1 space-y-2">
              <Skeleton height="16px" width="70%" />
              <Skeleton height="14px" width="50%" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
