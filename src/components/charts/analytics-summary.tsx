interface Props {
  bullets: string[];
}

export function AnalyticsSummary({ bullets }: Props) {
  if (bullets.length === 0) return null;

  return (
    <ul className="space-y-2">
      {bullets.map((b, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="font-mono text-[11px] text-accent mt-0.5 shrink-0">・</span>
          <span className="font-mono text-[12px] text-foreground leading-relaxed">{b}</span>
        </li>
      ))}
    </ul>
  );
}
