import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-hairline bg-surface">
      <div className="wrap flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center !py-6">
        <p className="small muted">
          Beacon gives guidance, not a decision. Always confirm with GOV.UK or a
          free adviser.
        </p>
        <Link className="small" href="/about">
          How Beacon works and your privacy
        </Link>
        <Link className="small" href="/transparency">
          How Beacon is checked
        </Link>
      </div>
    </footer>
  );
}
