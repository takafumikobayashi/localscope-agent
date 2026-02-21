import { StatusBadge } from "@/components/ui/status-badge";

export function Footer() {
  return (
    <footer className="border-t border-card-border mt-auto">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-4">
        <p className="font-mono text-xs text-muted">
          LocalScope Agent v0.1.0
        </p>
        <StatusBadge />
      </div>
    </footer>
  );
}
