import { SCHEMES, type SchemeId } from "@beacon/rules";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FindingDetail } from "@/components/results/FindingDetail";

export const generateStaticParams = () =>
  SCHEMES.map((s) => ({ scheme: s.id }));
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/results/[scheme]">): Promise<Metadata> {
  const { scheme } = await params;
  return { title: SCHEMES.find((s) => s.id === scheme)?.name ?? "Your result" };
}

// Frame: First step | Feeling: capable.
export default async function SchemePage({
  params,
}: PageProps<"/results/[scheme]">) {
  const { scheme } = await params;
  const found = SCHEMES.find((s) => s.id === scheme);
  if (!found) notFound();
  return <FindingDetail schemeId={found.id as SchemeId} />;
}
