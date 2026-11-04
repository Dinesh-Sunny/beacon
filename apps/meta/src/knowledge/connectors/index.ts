import { charitycommission } from "./charitycommission.ts";
import { councils } from "./councils.ts";
import { govuk } from "./govuk.ts";
import { ofcom } from "./ofcom.ts";
import { threesixty } from "./threesixty.ts";
import type { Connector } from "./types.ts";
import { uslocal } from "./uslocal.ts";

/** Every data source Beacon harvests from. Add a connector here and it runs everywhere. */
export const CONNECTORS: Connector[] = [
  govuk,
  ofcom,
  threesixty,
  councils,
  charitycommission,
  uslocal,
];
export type { Connector };
