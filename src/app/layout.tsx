import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const dmSans = localFont({
  src: [
    { path: "./fonts/font-0.ttf", weight: "400", style: "normal" },
    { path: "./fonts/font-1.ttf", weight: "500", style: "normal" },
    { path: "./fonts/font-2.ttf", weight: "600", style: "normal" },
    { path: "./fonts/font-3.ttf", weight: "700", style: "normal" },
    { path: "./fonts/font-4.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/font-8.ttf", weight: "400", style: "normal" },
    { path: "./fonts/font-7.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});
const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/font-5.ttf", weight: "400", style: "normal" },
    { path: "./fonts/font-6.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SatSlots — Your space. Your terms. Your sats.",
  description:
    "A little space. A more human internet. SatSlots is a direct sponsorship marketplace concept for independent publishers, built around Nostr and Bitcoin Lightning.",
  icons: { icon: { url: "./assets/favicon.svg", type: "image/svg+xml" } },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3eb" },
    { media: "(prefers-color-scheme: dark)", color: "#191e19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="./theme-init.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${dmSans.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} min-h-dvh antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
