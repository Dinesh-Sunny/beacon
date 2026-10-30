export { type Address, parseAddress, parseAddressList } from "./address.ts";
export * from "./config.ts";
export { devTransport } from "./dev.ts";
export {
  type CreateMailerOptions,
  createMailer,
  emailSender,
  isEmailConfigured,
} from "./mailer.ts";
export {
  EmailConfigError,
  type EmailMessage,
  EmailNotConfiguredError,
  type Mailer,
  type SentEmail,
  validateMessage,
} from "./message.ts";
export {
  createSesTransport,
  type SesTransportConfig,
  sesSendInput,
} from "./ses.ts";
