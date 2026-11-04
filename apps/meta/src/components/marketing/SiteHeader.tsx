import Link from "next/link";
import { Logo } from "@/components/Icon";
import { PlaceButton } from "@/components/locale/PlaceDialog";
import { getT } from "@/i18n/server";

export async function SiteHeader({ current }: { current?: "how" }) {
  const t = await getT();
  return (
    <>
      <a className="skip-link" href="#main">
        {t("site.skip")}
      </a>
      <header className="site-head mk-head">
        <Link href="/" className="brand" transitionTypes={["nav-back"]}>
          <Logo />
          <span>Beacon</span>
        </Link>
        <nav>
          <PlaceButton />
          <Link
            href="/how"
            aria-current={current === "how" ? "page" : undefined}
          >
            {t("site.how")}
          </Link>
          <Link
            href="/check"
            className="btn small"
            transitionTypes={["nav-forward"]}
          >
            {t("site.start")}
          </Link>
        </nav>
      </header>
    </>
  );
}
