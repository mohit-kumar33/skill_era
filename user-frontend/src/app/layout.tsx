import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Skill Era | Competitive Gaming Tournaments",
  description:
    "Join verified esports tournaments, track rewards, and compete with players worldwide on Skill Era.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-gray-900 bg-gray-50`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
