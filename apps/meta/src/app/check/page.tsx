import type { Metadata } from "next";
import { Workspace } from "@/components/Workspace";

export const metadata: Metadata = { title: "Your check" };

export default function CheckPage() {
  return <Workspace />;
}
