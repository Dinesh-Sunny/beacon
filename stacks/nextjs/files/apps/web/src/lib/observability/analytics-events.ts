// Product event names, one place so dashboards and code agree. snake_case, past tense.
export const ANALYTICS_EVENTS = {
  signedUp: "user_signed_up",
  signedIn: "user_signed_in",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
