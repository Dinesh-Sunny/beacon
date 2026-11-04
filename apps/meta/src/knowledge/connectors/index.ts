import { councils } from "./councils.ts";
import { govuk } from "./govuk.ts";
import { ofcom } from "./ofcom.ts";
import { threesixty } from "./threesixty.ts";
import type { Connector } from "./types.ts";

/** Every data source Beacon harvests from. Add a connector here and it runs everywhere. */
export const CONNECTORS: Connector[] = [govuk, ofcom, threesixty, councils];
export type { Connector };
