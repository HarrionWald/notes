import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // User data is private and dynamic, so the app does not use Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["pdfjs-dist", "tesseract.js", "mammoth"],
};

export default nextConfig;
