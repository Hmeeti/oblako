import type { Metadata, Viewport } from "next";
import { Manrope, Onest } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — электронные QR-меню`,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline.ru,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  openGraph: {
    title: brand.name,
    description: brand.tagline.ru,
    images: ["/brand/og.png"],
    locale: "ru_KZ",
    type: "website",
  },
  alternates: {
    languages: {
      ru: "/",
      kk: "/?lang=kk",
    },
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon-16.png", sizes: "16x16" },
      { url: "/brand/favicon-32.png", sizes: "32x32" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: brand.colors.cream,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    description: brand.tagline.ru,
    url: process.env.NEXT_PUBLIC_APP_URL || `https://${brand.domain}`,
  };

  return (
    <html lang="ru">
      <body className={`${onest.variable} ${manrope.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
