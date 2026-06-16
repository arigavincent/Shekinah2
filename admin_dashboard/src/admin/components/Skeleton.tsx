import type { CSSProperties } from "react";

type SkeletonProps = {
  variant?: "text" | "title" | "line" | "row" | "avatar" | "stat";
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
};

export function Skeleton({ variant = "text", width, height, style }: SkeletonProps) {
  return (
    <span
      className={`skeleton ${variant}`}
      aria-hidden="true"
      style={{ width, height, ...style }}
    />
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" role="status" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="row" />
      ))}
    </div>
  );
}

export function SkeletonStats({ cards = 4 }: { cards?: number }) {
  return (
    <div className="stats-grid" role="status" aria-label="Loading statistics">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} variant="stat" />
      ))}
    </div>
  );
}
