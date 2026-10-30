// Drizzle tables owned by the app (auth, consent, ledgers, audit). Payload manages its own tables.
// Export every table from here: the client and drizzle-kit both read this module.

export * from "./agents.ts";
export * from "./auth.ts";
export * from "./consent.ts";
export * from "./graph.ts";
