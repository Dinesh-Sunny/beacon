"use client";

import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/lib/format";
import { DATA_EXPORT_PATH } from "@/lib/privacy/config";
import { MutationMessage } from "./MutationMessage";
import type { MutationState } from "./use-auth-mutation";

const TOO_MANY_REQUESTS = 429;
const FALLBACK_FILE_NAME = "data.json";
const FILE_NAME_UTF8 = /filename\*=UTF-8''([^;]+)/;
const FILE_NAME = /filename="([^"]+)"/;

function fileName(disposition: string | null): string {
  const encoded = disposition?.match(FILE_NAME_UTF8)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return disposition?.match(FILE_NAME)?.[1] ?? FALLBACK_FILE_NAME;
}

// The route answers refusals with `{ message }` in plain words (sign in again, too many).
async function refusalMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : null;
  } catch {
    return null;
  }
}

// Saves a fetched file through a temporary link, so errors can be shown on the page instead of
// the browser saving an error response as the download.
function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function download(): Promise<MutationState> {
  let response: Response;
  try {
    response = await fetch(DATA_EXPORT_PATH, { cache: "no-store" });
  } catch {
    return {
      status: "error",
      message:
        "Couldn't reach the server. Check your connection and try again.",
    };
  }
  if (response.status === TOO_MANY_REQUESTS) {
    const seconds = Number(response.headers.get("Retry-After"));
    return {
      status: "error",
      message: Number.isFinite(seconds)
        ? `You've downloaded your data a few times. Try again in ${formatDuration(Math.ceil(seconds / 60) * 60)}.`
        : "You've downloaded your data a few times. Try again later.",
    };
  }
  if (!response.ok) {
    return {
      status: "error",
      message:
        (await refusalMessage(response)) ??
        "The download didn't start. Reload the page and try again.",
    };
  }
  saveFile(
    await response.blob(),
    fileName(response.headers.get("Content-Disposition")),
  );
  return { status: "done", message: "Your data is downloading." };
}

export function DataExportButton() {
  const [state, run, pending] = useActionState<MutationState>(download, {
    status: "idle",
  });
  return (
    <form action={run} className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="pointer-coarse:min-h-11"
      >
        {pending ? (
          <Spinner className="motion-reduce:animate-none" />
        ) : (
          <HugeiconsIcon
            icon={Download04Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
        )}
        Download your data
      </Button>
      <MutationMessage state={state} />
    </form>
  );
}
