import { type Address, parseAddress } from "./address.ts";
import { EMAIL_ENV } from "./config.ts";
import { devTransport } from "./dev.ts";
import {
  EmailNotConfiguredError,
  type Mailer,
  validateMessage,
} from "./message.ts";
import { createSesTransport, type SesTransportConfig } from "./ses.ts";

type Env = Readonly<Record<string, string | undefined>>;

export type CreateMailerOptions = {
  env?: Env;
  // Tests inject a fake SES client.
  sesClient?: SesTransportConfig["client"];
};

type SesSettings = Omit<SesTransportConfig, "client">;

function sesSettings(env: Env): SesSettings | undefined {
  const from = env[EMAIL_ENV.from];
  const region = env[EMAIL_ENV.sesRegion];
  if (!from || !region) return undefined;
  return {
    region,
    from,
    replyTo: env[EMAIL_ENV.replyTo] || undefined,
    configurationSet: env[EMAIL_ENV.sesConfigurationSet] || undefined,
  };
}

// True when a real provider is set up. Production without one can't send verification or reset
// emails; health checks and startup logs report it.
export function isEmailConfigured(env: Env = process.env): boolean {
  return sesSettings(env) !== undefined;
}

// The default sender, for code that has to name one (Payload's admin). Undefined until
// EMAIL_FROM is set.
export function emailSender(env: Env = process.env): Address | undefined {
  const from = env[EMAIL_ENV.from];
  return from ? parseAddress(from) : undefined;
}

// SES when EMAIL_FROM and AWS_SES_REGION are set (any environment, so staging can send for
// real). Otherwise the dev transport, except in production, where a missing provider must fail
// loudly instead of silently dropping verification and reset emails.
export function createMailer(options: CreateMailerOptions = {}): Mailer {
  const env = options.env ?? process.env;
  const settings = sesSettings(env);
  if (settings) {
    return validated(
      createSesTransport({ ...settings, client: options.sesClient }),
    );
  }
  if (env.NODE_ENV === "production") {
    throw new EmailNotConfiguredError(
      `Set ${EMAIL_ENV.from} and ${EMAIL_ENV.sesRegion} to send email. See docs/knowledge/email.md`,
    );
  }
  return validated(devTransport);
}

// Same rules for every transport, so a message the dev log accepts is one SES accepts too.
function validated(mailer: Mailer): Mailer {
  return {
    transport: mailer.transport,
    send: async (message) => {
      validateMessage(message);
      return mailer.send(message);
    },
  };
}
