interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="font-mono text-2xl font-bold tracking-tight">
        <span className="text-accent glow">{">"}</span>{" "}
        <span className="text-foreground">{title}</span>
      </h1>
      {description && (
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
