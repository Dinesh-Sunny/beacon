import Link from "next/link";
import { Logo } from "@/components/Icon";

export function SiteHeader({ current }: { current?: "how" }) {
  return (
    <header className="site-head mk-head">
      <Link href="/" className="brand">
        <Logo />
        <span>Beacon</span>
      </Link>
      <nav>
        <Link href="/how" aria-current={current === "how" ? "page" : undefined}>
          How it works
        </Link>
        <Link href="/check" className="btn small">
          Start a check
        </Link>
      </nav>
    </header>
  );
}
