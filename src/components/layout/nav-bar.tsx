import Link from "next/link";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/analytics", label: "Analytics" },
];

export function NavBar() {
  return (
    <header className="border-b border-card-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <nav className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
          <span className="font-mono text-sm font-bold tracking-wider text-accent glow">
            LOCALSCOPE
          </span>
        </Link>
        <ul className="flex items-center gap-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="font-mono text-xs tracking-wide text-muted-foreground hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
