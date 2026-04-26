export default function Footer() {
  return (
    <footer className="border-t border-border/60 mt-20">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between text-sm text-muted">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-fg">AgentTollgate</span>
          <span>·</span>
          <span>Drop-in paywall for the agentic economy</span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <span>Built on <a className="text-accent hover:underline" href="https://paywithlocus.com">Locus</a></span>
          <span>Submitted to <a className="text-accent hover:underline" href="https://paygentic-week3.devfolio.co">Paygentic Week 3</a></span>
          <span>USDC · Base</span>
          <span className="text-xs">© 2026</span>
        </div>
      </div>
    </footer>
  );
}
