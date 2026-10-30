import assert from "node:assert/strict";
import { test } from "node:test";
import type { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createMailer, emailSender, isEmailConfigured } from "./mailer.ts";
import { EmailConfigError, EmailNotConfiguredError } from "./message.ts";
import { sesSendInput } from "./ses.ts";

const MESSAGE = {
  to: "reader@example.com",
  subject: "Check your email",
  html: "<p>Hi</p>",
  text: "Hi",
  kind: "verify-email",
};

const SES_ENV = {
  EMAIL_FROM: "__NAME__ <hello@mail.example.com>",
  AWS_SES_REGION: "eu-west-2",
};

test("should pick SES when the sender and region are set", () => {
  assert.equal(createMailer({ env: SES_ENV }).transport, "ses");
});

test("should fall back to the dev transport outside production", () => {
  assert.equal(
    createMailer({ env: { NODE_ENV: "development" } }).transport,
    "dev",
  );
});

test("should refuse to start in production without SES", () => {
  assert.throws(
    () => createMailer({ env: { NODE_ENV: "production" } }),
    EmailNotConfiguredError,
  );
});

test("should send through the SES client with the kind tag and configuration set", async () => {
  const sent: SendEmailCommand[] = [];
  const mailer = createMailer({
    env: { ...SES_ENV, AWS_SES_CONFIGURATION_SET: "transactional" },
    sesClient: {
      send: async (command: SendEmailCommand) => {
        sent.push(command);
        return { MessageId: "ses-1", $metadata: {} };
      },
    } as never,
  });
  assert.deepEqual(await mailer.send(MESSAGE), { messageId: "ses-1" });
  const input = sent[0]?.input;
  assert.equal(input?.FromEmailAddress, SES_ENV.EMAIL_FROM);
  assert.deepEqual(input?.Destination?.ToAddresses, [MESSAGE.to]);
  assert.equal(input?.ConfigurationSetName, "transactional");
  assert.deepEqual(input?.EmailTags, [{ Name: "kind", Value: "verify-email" }]);
  assert.equal(input?.Content?.Simple?.Body?.Text?.Data, "Hi");
});

test("should let a message override the sender and reply-to", () => {
  const input = sesSendInput(
    {
      ...MESSAGE,
      from: "tenant <hi@tenant.example>",
      replyTo: "help@tenant.example",
    },
    { from: SES_ENV.EMAIL_FROM, replyTo: "support@example.com" },
  );
  assert.equal(input.FromEmailAddress, "tenant <hi@tenant.example>");
  assert.deepEqual(input.ReplyToAddresses, ["help@tenant.example"]);
  assert.equal(input.ConfigurationSetName, undefined);
});

test("should reject a kind SES can't tag", () => {
  assert.throws(
    () =>
      sesSendInput(
        { ...MESSAGE, kind: "verify email" },
        { from: SES_ENV.EMAIL_FROM },
      ),
    EmailConfigError,
  );
});

test("should omit the text part when a message has only HTML", () => {
  const { text: _text, ...htmlOnly } = MESSAGE;
  const input = sesSendInput(htmlOnly, { from: SES_ENV.EMAIL_FROM });
  assert.equal(input.Content?.Simple?.Body?.Text, undefined);
  assert.equal(input.Content?.Simple?.Body?.Html?.Data, MESSAGE.html);
});

test("should reject a bad kind in the dev transport too", async (t) => {
  t.mock.method(console, "info", () => {});
  const mailer = createMailer({ env: { NODE_ENV: "development" } });
  await assert.rejects(
    mailer.send({ ...MESSAGE, kind: "order receipt" }),
    EmailConfigError,
  );
});

test("should send extra tags after the kind tag", () => {
  const input = sesSendInput(
    { ...MESSAGE, tags: { tenant: "northwind" } },
    { from: SES_ENV.EMAIL_FROM },
  );
  assert.deepEqual(input.EmailTags, [
    { Name: "kind", Value: "verify-email" },
    { Name: "tenant", Value: "northwind" },
  ]);
});

test("should refuse a tag that would duplicate the kind", () => {
  assert.throws(
    () =>
      sesSendInput(
        { ...MESSAGE, tags: { kind: "other" } },
        { from: SES_ENV.EMAIL_FROM },
      ),
    EmailConfigError,
  );
});

test("should report configuration and the sender from env", () => {
  assert.equal(isEmailConfigured(SES_ENV), true);
  assert.equal(
    isEmailConfigured({ EMAIL_FROM: "", AWS_SES_REGION: "eu-west-2" }),
    false,
  );
  assert.deepEqual(emailSender(SES_ENV), {
    name: "__NAME__",
    address: "hello@mail.example.com",
  });
  assert.equal(emailSender({ EMAIL_FROM: "" }), undefined);
});
