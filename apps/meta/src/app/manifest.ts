import type { MetadataRoute } from "next";

// Lets people add Beacon to their home screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beacon",
    short_name: "Beacon",
    description: "Find the support that's already yours.",
    start_url: "/check",
    display: "standalone",
    background_color: "#F4EFE7",
    theme_color: "#F4EFE7",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
