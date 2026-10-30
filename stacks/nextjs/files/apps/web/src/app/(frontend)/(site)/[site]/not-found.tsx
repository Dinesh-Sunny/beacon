import Link from "next/link";
import { Section } from "@/components/site/Section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

// Unknown or unpublished CMS slugs, inside the site's header and footer. The page streams, so
// the response is a 200 with `noindex` rather than a 404 status (a Cache Components limit, see
// docs/knowledge/payload.md); search engines drop it either way.
export default function SiteNotFound() {
  return (
    <Section className="flex flex-1 items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            <h1 className="font-heading text-2xl">Page not found</h1>
          </EmptyTitle>
          <EmptyDescription>
            This address doesn&apos;t match any page on the site.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="lg" className="pointer-coarse:min-h-11">
            <Link href="/">Go to the homepage</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </Section>
  );
}
