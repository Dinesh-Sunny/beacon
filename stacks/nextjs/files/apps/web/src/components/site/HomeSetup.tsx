import { File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Section } from "@/components/site/Section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { SiteContext } from "@/lib/tenant";
import {
  COLLECTIONS,
  HOME_SLUG,
  PAYLOAD_ADMIN_ROUTE,
} from "@/payload/constants";

// Development builds tell the person running the site how to finish it; production visitors
// only see that the page isn't ready (and the route is noindex until it is).
const SHOW_SETUP_STEPS = process.env.NODE_ENV !== "production";

export function HomeSetup({ site }: { site: SiteContext }) {
  return (
    <Section className="flex flex-1 items-center justify-center">
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="font-heading text-2xl">{site.name}</h1>
          </EmptyTitle>
          <EmptyDescription>
            {SHOW_SETUP_STEPS ? (
              <>
                No home page yet. Create a page with the slug{" "}
                <code className="font-mono">{HOME_SLUG}</code> in the CMS, add
                sections, and publish it.
              </>
            ) : (
              "This site is getting ready. Check back soon."
            )}
          </EmptyDescription>
        </EmptyHeader>
        {SHOW_SETUP_STEPS && (
          <EmptyContent>
            <Button asChild className="pointer-coarse:min-h-11">
              <a
                href={`${PAYLOAD_ADMIN_ROUTE}/collections/${COLLECTIONS.pages}/create`}
              >
                Create the home page
              </a>
            </Button>
          </EmptyContent>
        )}
      </Empty>
    </Section>
  );
}
