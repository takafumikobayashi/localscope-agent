interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`rounded animate-shimmer ${className}`}
      aria-hidden="true"
    />
  );
}
