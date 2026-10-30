import * as Sentry from "@sentry/nextjs";
import { SENTRY_OPTIONS } from "@/lib/observability/sentry-options";

Sentry.init(SENTRY_OPTIONS);
