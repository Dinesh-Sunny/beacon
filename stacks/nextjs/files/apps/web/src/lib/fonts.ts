import { Geist, Geist_Mono, Inter, Merriweather } from "next/font/google";
import { cn } from "@/lib/utils";

// Shared by every root layout (the site and the global 404). design-tokens.py reads the
// `variable` names here to mirror typography into DESIGN.md.
const merriweatherHeading = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const FONT_CLASS_NAMES = cn(
  geistSans.variable,
  geistMono.variable,
  "font-sans",
  inter.variable,
  merriweatherHeading.variable,
);
