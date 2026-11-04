import { Icon } from "@/components/Icon";
import COUNTS from "@/data/data-counts.json";
import { schemesOf, topicsOf } from "@/engine/rules";
import { flagOf } from "@/i18n/countries";
import { intlTag } from "@/i18n/locales";
import { getLocale, getT } from "@/i18n/server";

// One card per country Beacon checks: its schemes, life areas and the local data behind it.
// Every number comes from the packs and the data builders, so it never goes stale.
export async function Countries() {
  const t = await getT();
  const locale = await getLocale();
  const n = (x: number) => new Intl.NumberFormat(intlTag(locale)).format(x);
  const cards = [
    {
      code: "GB",
      name: t("home.countries.uk.name"),
      where: t("home.countries.uk.where"),
      local: [
        [COUNTS.councilLinks.links, t("home.countries.uk.councilPages")],
        [COUNTS.charityFunds.funds, t("home.countries.uk.charities")],
      ],
      sample: [
        "Pension Credit",
        "Attendance Allowance",
        "Council Tax Reduction",
      ],
    },
    {
      code: "US",
      name: t("home.countries.us.name"),
      where: t("home.countries.us.where"),
      local: [
        [COUNTS.usLocal.centers, t("home.countries.us.centers")],
        [COUNTS.usLocal.agencies, t("home.countries.us.agencies")],
        [COUNTS.usLocal.counselors, t("home.countries.us.counselors")],
      ],
      sample: ["SNAP", "Medicaid", "Earned Income Tax Credit"],
    },
  ] as const;
  return (
    <ul className="mk-countries">
      {cards.map((c) => (
        <li key={c.code} className="mk-country">
          <div className="mk-country-top">
            <span className="flag" aria-hidden="true">
              {flagOf(c.code)}
            </span>
            <div>
              <b>{c.name}</b>
              <span>{c.where}</span>
            </div>
          </div>
          <p className="mk-country-big">
            <span>{n(schemesOf(c.code).length)}</span>
            {t("home.countries.kinds", {
              topics: topicsOf(c.code).length,
            })}
          </p>
          <p className="mk-country-sample">{c.sample.join(" · ")}</p>
          <ul
            className="mk-country-local"
            aria-label={t("home.countries.localLabel")}
          >
            {c.local.map(([x, label]) => (
              <li key={label}>
                <Icon name="pin" size={14} />
                <b>{n(x)}</b> {label}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
