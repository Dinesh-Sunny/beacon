import { randomUUID } from "node:crypto";
import { AiChat02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getAccountContext } from "@/lib/account";
import { type AgentThreadSummary, listAgentThreads } from "@/lib/agent-threads";
import { ACCOUNT_ASSISTANT_AGENT, isAiConfigured } from "@/lib/agents";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Assistant",
  path: AUTH_ROUTES.accountAssistant,
  noIndex: true,
});

const UNTITLED = "New conversation";

function threadHref(id: string) {
  return {
    pathname: AUTH_ROUTES.accountAssistant,
    query: { thread: id },
  } as const;
}

function ConversationList({
  threads,
  currentId,
}: {
  threads: AgentThreadSummary[];
  currentId: string;
}) {
  if (threads.length === 0) {
    return (
      <p className="px-2 text-sm text-pretty text-muted-foreground">
        Your conversations appear here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {threads.map((thread) => {
        const isCurrent = thread.id === currentId;
        return (
          <li key={thread.id}>
            <Link
              href={threadHref(thread.id)}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col justify-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isCurrent && "bg-muted font-medium",
              )}
            >
              <span className="truncate">{thread.title ?? UNTITLED}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(thread.updatedAt)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function Assistant({
  searchParams,
}: {
  searchParams: PageProps<"/account/assistant">["searchParams"];
}) {
  const { user } = await getAccountContext(AUTH_ROUTES.accountAssistant);
  const newConversation = (
    <Button asChild variant="outline" className="pointer-coarse:min-h-11">
      <Link href={AUTH_ROUTES.accountAssistant}>
        <HugeiconsIcon
          icon={PlusSignIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        New conversation
      </Link>
    </Button>
  );
  const header = (action?: React.ReactNode) => (
    <AccountPageHeader
      title="Assistant"
      description="Ask about your account and organizations in plain words."
      action={action}
    />
  );

  if (!isAiConfigured()) {
    return (
      <>
        {header()}
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={AiChat02Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>The assistant isn't set up on this site</EmptyTitle>
            <EmptyDescription>
              It needs AI Gateway credentials before it can answer.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  const { thread: requested } = await searchParams;
  const threads = await listAgentThreads(user.id, ACCOUNT_ASSISTANT_AGENT);
  // Only our own conversations open; anything else starts a new one.
  const current = threads.find((thread) => thread.id === requested);
  const threadId = current?.id ?? randomUUID();
  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <>
      {header(newConversation)}
      <div className="grid gap-6 md:grid-cols-4">
        <nav
          aria-label="Conversations"
          className="order-last flex flex-col gap-2 md:order-first"
        >
          <h2 className="px-2 text-xs font-medium text-muted-foreground">
            Conversations
          </h2>
          <ConversationList threads={threads} currentId={threadId} />
        </nav>
        <section
          aria-label="Conversation"
          className="h-128 overflow-hidden rounded-xl border md:col-span-3 md:h-160"
        >
          <AssistantChat
            key={threadId}
            agent={ACCOUNT_ASSISTANT_AGENT}
            threadId={threadId}
            hasHistory={Boolean(current)}
            firstName={firstName}
          />
        </section>
      </div>
    </>
  );
}

export default function AssistantPage({
  searchParams,
}: PageProps<"/account/assistant">) {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <Assistant searchParams={searchParams} />
    </Suspense>
  );
}
