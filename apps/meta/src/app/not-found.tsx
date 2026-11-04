import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="state-page" id="main">
      <h1>{t("errors.notFoundTitle")}</h1>
      <p>{t("errors.notFoundBody")}</p>
      <div className="row">
        <Link href="/check" className="btn" transitionTypes={["nav-forward"]}>
          {t("site.start")}
        </Link>
        <Link href="/" className="btn ghost">
          {t("errors.home")}
        </Link>
      </div>
    </main>
  );
}
