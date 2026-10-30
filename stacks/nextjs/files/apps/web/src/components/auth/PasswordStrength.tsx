import { PASSWORD_POLICY } from "@__NAME__/auth/config";
import { cn } from "@/lib/utils";

const SEGMENTS = 4;
// Characters past the minimum that move a password from "fair" to "strong".
const LENGTH_BONUS = 6;
const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];
const LABELS = ["", "Too short", "Fair", "Good", "Strong"] as const;

// Guidance only: the server enforces the minimum and checks known breaches on submit.
function score(password: string): number {
  if (!password) return 0;
  if (password.length < PASSWORD_POLICY.minLength) return 1;
  const variety = CHARACTER_CLASSES.filter((pattern) =>
    pattern.test(password),
  ).length;
  const long = password.length >= PASSWORD_POLICY.minLength + LENGTH_BONUS;
  return Math.min(SEGMENTS, 2 + (variety >= 3 ? 1 : 0) + (long ? 1 : 0));
}

export function PasswordStrength({
  password,
  id,
}: {
  password: string;
  id: string;
}) {
  const value = score(password);
  const missing = PASSWORD_POLICY.minLength - password.length;
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length meter, never reordered
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full bg-muted transition-colors duration-300 motion-reduce:transition-none",
              index < value && (value === 1 ? "bg-destructive" : "bg-primary"),
            )}
          />
        ))}
      </div>
      <p id={id} aria-live="polite" className="text-sm text-muted-foreground">
        {value === 0 &&
          `${PASSWORD_POLICY.minLength}+ characters. A short phrase works.`}
        {value === 1 &&
          `${missing} more ${missing === 1 ? "character" : "characters"}`}
        {value > 1 && LABELS[value]}
      </p>
    </div>
  );
}
