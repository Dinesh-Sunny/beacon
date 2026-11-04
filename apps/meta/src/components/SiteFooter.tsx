import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <p>
        Beacon gives general information, not advice. The organisation that runs
        each scheme makes the decision, and every result links to its official
        page.
      </p>
      <nav>
        <Link href="/check">Start a check</Link>
        <Link href="/how">How it works</Link>
        <a
          href="https://github.com/Dinesh-Sunny/beacon"
          target="_blank"
          rel="noreferrer"
        >
          Code on GitHub
        </a>
      </nav>
    </footer>
  );
}
