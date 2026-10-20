import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Notes",
    short_name: "Notes",
    description: "Private personal notes, lectures, and handwriting.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#0f5e5b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
