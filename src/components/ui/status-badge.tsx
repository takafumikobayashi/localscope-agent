export function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-accent/20 bg-accent/5 px-2 py-0.5 font-mono text-[10px] tracking-widest text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
      OPERATIONAL
    </span>
  );
}
