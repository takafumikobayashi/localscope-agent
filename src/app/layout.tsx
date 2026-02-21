import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "@/components/layout/nav-bar";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LocalScope Agent",
  description:
    "地方自治体の議会会議録を構造化し、人間とAIの双方が読解可能にする市政インテリジェンス基盤",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased scanline min-h-screen flex flex-col`}
      >
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
