import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Every variable the web app reads, validated once at build and boot. Names live in .env.example.
export const env = createEnv({
  server: {
    // Beam through an OpenAI-compatible endpoint (HF router by default); read by @beacon/brain.
    BEAM_BASE_URL: z.url().optional(),
    BEAM_MODEL: z.string().min(1).optional(),
    HF_TOKEN: z.string().min(1).optional(),
    // Checks allowed per UTC day across the whole Space; protects the free model quota.
    BEACON_DAILY_CAP: z.coerce.number().int().positive().default(500),
    // Requests allowed per IP per minute, per route.
    BEACON_PER_IP_PER_MINUTE: z.coerce.number().int().positive().default(5),
    // Model tokens (input plus output) allowed per UTC day across the whole Space.
    BEACON_DAILY_TOKENS: z.coerce.number().int().positive().default(30_000_000),
    LANGSMITH_TRACING: z.enum(["true", "false"]).optional(),
    LANGSMITH_API_KEY: z.string().optional(),
    LANGSMITH_ENDPOINT: z.url().optional(),
    LANGSMITH_PROJECT: z.string().optional(),
    // Tracing must never record answers or letters: both must be "true" whenever tracing is on.
    LANGSMITH_HIDE_INPUTS: z.enum(["true", "false"]).optional(),
    LANGSMITH_HIDE_OUTPUTS: z.enum(["true", "false"]).optional(),
  },
  client: {
    // Where "This looks wrong" reports go. Unset: the sheet points to GOV.UK and free help instead.
    NEXT_PUBLIC_REPORT_EMAIL: z.email().optional(),
    NEXT_PUBLIC_REPORT_ISSUES_URL: z.url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_REPORT_EMAIL: process.env.NEXT_PUBLIC_REPORT_EMAIL,
    NEXT_PUBLIC_REPORT_ISSUES_URL: process.env.NEXT_PUBLIC_REPORT_ISSUES_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
