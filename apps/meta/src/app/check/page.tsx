import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import { Workspace } from "@/components/Workspace";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("meta.checkTitle"), robots: { index: false } };
}

export default function CheckPage() {
  return (
    <PageTransition>
      <Workspace />
    </PageTransition>
  );
}
