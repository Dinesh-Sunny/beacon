"use client";

import { createAgencyAuthClient } from "@__NAME__/auth/client";

// One client for the browser: sign in/up, organizations, API keys, two-factor, magic links.
export const authClient = createAgencyAuthClient();
