import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || `https://${brand.domain}`;
  return [
    {
      url: `${base}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
