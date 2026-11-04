"use client";

// A calm page for anything that breaks: answers stay on this device, so trying again is safe.
import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "use-intl";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="state-page" id="main">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <div className="row">
        <button type="button" className="btn" onClick={() => retry()}>
          {t("retry")}
        </button>
        <Link href="/" className="btn ghost">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
