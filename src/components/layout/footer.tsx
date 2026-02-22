import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";

export function Footer() {
  return (
    <footer className="border-t border-card-border mt-auto">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="font-mono text-xs text-muted">
            LocalScope Agent v0.1.0
          </p>
          <Link
            href="/disclaimer"
            className="font-mono text-xs text-muted hover:text-muted-foreground transition-colors"
          >
            免責事項
          </Link>
          <a
            href="https://github.com/takafumikobayashi/localscope-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-muted hover:text-muted-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs text-muted whitespace-nowrap">
            © {new Date().getFullYear()} tariki-code. All Rights Reserved.
          </p>
          <StatusBadge />
        </div>
      </div>
    </footer>
  );
}
