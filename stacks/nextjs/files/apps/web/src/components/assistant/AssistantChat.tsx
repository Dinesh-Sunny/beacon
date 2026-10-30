"use client";

import { HttpAgent, type Message } from "@ag-ui/client";
import {
  AssistantRuntimeProvider,
  ExportedMessageRepository,
} from "@assistant-ui/react";
import { fromAgUiMessages, useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AGENT_ROUTE, type AgentName } from "@/lib/agents";
import { AUTH_ROUTES } from "@/lib/auth-routes";

// Prompts on an empty conversation: what the demo agent's tools can actually answer.
const SUGGESTIONS = [
  { prompt: "Which organizations am I in, and what's my role?" },
  { prompt: "What's the date and time now in UTC?" },
];

// The conversation was deleted (retention) since the list rendered.
const NOT_FOUND = 404;

async function loadMessages(
  agent: AgentName,
  threadId: string,
  onGone: () => void,
) {
  const response = await fetch(
    `${AGENT_ROUTE}/${agent}/threads/${encodeURIComponent(threadId)}`,
    { cache: "no-store" },
  );
  if (response.status === NOT_FOUND) {
    onGone();
    return ExportedMessageRepository.fromArray([]);
  }
  if (!response.ok) throw new Error(`History failed with ${response.status}`);
  const { messages } = (await response.json()) as { messages: Message[] };
  return ExportedMessageRepository.fromArray(fromAgUiMessages(messages));
}

function Welcome({ firstName }: { firstName: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1 px-2">
      <p className="font-heading text-2xl text-balance">Hi {firstName}.</p>
      <p className="text-pretty text-muted-foreground">
        Ask about your account or your organizations. I can read them, not
        change them.
      </p>
    </div>
  );
}

// One conversation over AG-UI. Keyed by thread id in the page, so opening another conversation
// starts a fresh runtime. The thread id is the server's; the sidecar checks it belongs to us.
export function AssistantChat({
  agent,
  threadId,
  hasHistory,
  firstName,
}: {
  agent: AgentName;
  threadId: string;
  hasHistory: boolean;
  firstName: string;
}) {
  const router = useRouter();
  const [client] = useState(() => {
    const http = new HttpAgent({ url: `${AGENT_ROUTE}/${agent}`, threadId });
    // After each reply: put the conversation in the URL (reload reopens it) and refresh the
    // list, which picks up the new title.
    http.subscribe({
      onRunFinalized: () => {
        router.replace(
          `${AUTH_ROUTES.accountAssistant}?thread=${encodeURIComponent(threadId)}` as Route,
          { scroll: false },
        );
        router.refresh();
      },
    });
    return http;
  });
  // A stable component: an inline one would remount the welcome on every render.
  const [WelcomeForUser] = useState(
    () =>
      function WelcomeForUser() {
        return <Welcome firstName={firstName} />;
      },
  );
  const runtime = useAgUiRuntime({
    agent: client,
    suggestions: SUGGESTIONS,
    adapters: hasHistory
      ? {
          history: {
            load: () =>
              loadMessages(agent, threadId, () =>
                router.replace(AUTH_ROUTES.accountAssistant),
              ),
            // The agent's checkpoints already store every message.
            append: async () => {},
          },
        }
      : undefined,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* No autofocus: on phones it would open the keyboard over the page on arrival. */}
      <Thread components={{ Welcome: WelcomeForUser }} autoFocus={false} />
    </AssistantRuntimeProvider>
  );
}
