import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-sesv2";
import { EMAIL_KIND_TAG } from "./config.ts";
import { type EmailMessage, type Mailer, validateMessage } from "./message.ts";

export type SesTransportConfig = {
  region: string;
  from: string;
  replyTo?: string;
  configurationSet?: string;
  // Injected in tests; otherwise one client per mailer, using the SDK's default credential chain.
  client?: Pick<SESv2Client, "send">;
};

const CHARSET = "UTF-8";

export function sesSendInput(
  message: EmailMessage,
  config: Omit<SesTransportConfig, "client" | "region">,
): SendEmailCommandInput {
  validateMessage(message);
  const replyTo = message.replyTo ?? config.replyTo;
  return {
    FromEmailAddress: message.from ?? config.from,
    Destination: { ToAddresses: [message.to] },
    ...(replyTo && { ReplyToAddresses: [replyTo] }),
    Content: {
      Simple: {
        Subject: { Data: message.subject, Charset: CHARSET },
        Body: {
          Html: { Data: message.html, Charset: CHARSET },
          ...(message.text && {
            Text: { Data: message.text, Charset: CHARSET },
          }),
        },
      },
    },
    ...(config.configurationSet && {
      ConfigurationSetName: config.configurationSet,
    }),
    EmailTags: [
      { Name: EMAIL_KIND_TAG, Value: message.kind },
      ...Object.entries(message.tags ?? {}).map(([Name, Value]) => ({
        Name,
        Value,
      })),
    ],
  };
}

export function createSesTransport(config: SesTransportConfig): Mailer {
  const client = config.client ?? new SESv2Client({ region: config.region });
  return {
    transport: "ses",
    send: async (message) => {
      const output = await client.send(
        new SendEmailCommand(sesSendInput(message, config)),
      );
      if (!output.MessageId) {
        throw new Error("SES accepted the email but returned no MessageId");
      }
      return { messageId: output.MessageId };
    },
  };
}
