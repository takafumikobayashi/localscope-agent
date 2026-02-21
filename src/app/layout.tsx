import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Priority: 明示指定 > Vercel 自動注入（本番URL）> ローカル開発
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
const OG_IMAGE_URL = process.env.NEXT_PUBLIC_OG_IMAGE_URL; // e.g. https://xxxx.cloudfront.net/og.png
const DEFAULT_DESCRIPTION =
  "地方議会の会議録を自動収集・AI 要約・可視化するシビックインテリジェンス基盤。誰が・何を・どれだけ話したかを市民の手に届ける。";

const ogImages = OG_IMAGE_URL
  ? [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: "LocalScope Agent" }]
  : [];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LocalScope Agent",
    template: "%s | LocalScope Agent",
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    siteName: "LocalScope Agent",
    locale: "ja_JP",
    type: "website",
    description: DEFAULT_DESCRIPTION,
    images: ogImages,
  },
  twitter: {
    card: "summary_large_image",
    description: DEFAULT_DESCRIPTION,
    images: OG_IMAGE_URL ? [OG_IMAGE_URL] : [],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased scanline`}
      >
        {children}
      </body>
    </html>
  );
}
