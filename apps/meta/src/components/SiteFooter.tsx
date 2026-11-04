import Link from "next/link";
import { PlaceFooterLink } from "@/components/locale/PlaceDialog";
import { getT } from "@/i18n/server";

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="site-foot">
      <p>{t("site.footer")}</p>
      <nav>
        <PlaceFooterLink />
        <Link href="/check">{t("site.start")}</Link>
        <Link href="/how">{t("site.how")}</Link>
        <a
          href="https://github.com/Dinesh-Sunny/beacon"
          target="_blank"
          rel="noreferrer"
        >
          {t("site.code")}
        </a>
      </nav>
    </footer>
  );
}
