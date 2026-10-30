import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PreviewPage02 from "./_preview/page-body";
import PreviewPage01 from "./_preview-02/page-body";

// INTERNAL ONLY: design reference for the team, never published.
// Available in `next dev`; in production builds it 404s unless ENABLE_DESIGN_PAGE=1 is set.
const isEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_DESIGN_PAGE === "1";

export const metadata: Metadata = {
  title: "Design system · shadcn preset b4XwA3eDL6",
  robots: { index: false, follow: false },
};

// Both pages of shadcn's /create preview on one page (page 02 first, then page 01), rendered with
// OUR components and theme. New UI must reuse these compositions (see .claude/skills/design-system).
export default function DesignPage() {
  if (!isEnabled) {
    notFound();
  }
  return (
    <>
      <PreviewPage02 />
      <PreviewPage01 />
    </>
  );
}
