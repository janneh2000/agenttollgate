import Link from "next/link";
import { Button } from "./ui/button";
import { Logo } from "./logo";

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-md bg-bg/70">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo className="h-7 w-7 text-accent group-hover:rotate-3 transition-transform" />
          <span className="font-semibold tracking-tight">
            Agent<span className="gradient-text">Tollgate</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
          <Link href="/catalog" className="hover:text-fg">Catalog</Link>
          <Link href="/docs" className="hover:text-fg">Docs</Link>
          <Link href="/dashboard" className="hover:text-fg">Dashboard</Link>
          <a href="https://paywithlocus.com" target="_blank" rel="noreferrer" className="hover:text-fg">
            Powered by Locus
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">Dashboard</Button>
          </Link>
          <Link href="/dashboard/new">
            <Button size="sm">Tollgate an API →</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
