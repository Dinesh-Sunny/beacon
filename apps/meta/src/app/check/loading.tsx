import { getT } from "@/i18n/server";

// Shown while the check opens: the lamp, so the first frame already looks like Beacon.
export default async function Loading() {
  const t = await getT();
  return (
    <main className="state-page" aria-busy="true">
      <div className="lamp" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <p role="status">{t("errors.loading")}</p>
    </main>
  );
}
