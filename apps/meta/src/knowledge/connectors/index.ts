import { govuk } from "./govuk.ts";
import { ofcom } from "./ofcom.ts";
import type { Connector } from "./types.ts";

/** Every data source Beacon harvests from. Add a connector here and it runs everywhere. */
export const CONNECTORS: Connector[] = [govuk, ofcom];
export type { Connector };
