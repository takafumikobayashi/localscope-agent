interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-card-border bg-card-bg p-4 ${className}`}
    >
      {children}
    </div>
  );
}
