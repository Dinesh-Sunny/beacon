"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { TOTP_CODE_LENGTH } from "./constants";

const GROUP_SIZE = TOTP_CODE_LENGTH / 2;
const FIRST_GROUP = Array.from({ length: GROUP_SIZE }, (_, slot) => slot);
const SECOND_GROUP = FIRST_GROUP.map((slot) => GROUP_SIZE + slot);
// Big, friendly slots: the code is the whole screen.
const SLOT = "size-11 font-heading text-xl sm:size-13 sm:text-2xl";

// Authenticator code in two groups of three slots. Filling the last slot submits the form, so
// pasting or autofilling a code is one step.
export function OtpField({
  id,
  name = "code",
  disabled,
  describedBy,
  invalid = false,
}: {
  id: string;
  name?: string;
  disabled?: boolean;
  describedBy?: string;
  // After a rejected code: the slots turn destructive and the alert is announced with the field.
  invalid?: boolean;
}) {
  return (
    <InputOTP
      id={id}
      name={name}
      maxLength={TOTP_CODE_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      disabled={disabled}
      required
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onComplete={(_value: string) => {
        const field = document.getElementById(id);
        if (field instanceof HTMLInputElement) field.form?.requestSubmit();
      }}
      containerClassName="justify-start"
    >
      <InputOTPGroup>
        {FIRST_GROUP.map((slot) => (
          <InputOTPSlot
            key={slot}
            index={slot}
            aria-invalid={invalid || undefined}
            className={SLOT}
          />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        {SECOND_GROUP.map((slot) => (
          <InputOTPSlot
            key={slot}
            index={slot}
            aria-invalid={invalid || undefined}
            className={SLOT}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
