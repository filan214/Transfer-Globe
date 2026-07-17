import type { Metadata } from "next";
import { Archivo, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Archivo({
  variable: "--font-ui",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const description =
  "An interactive 3D globe of football transfers. Spin it, filter by window and league, and watch the fees arc from selling club to buying club.";

export const metadata: Metadata = {
  title: "Transfer Globe — football money in motion",
  description,
  openGraph: {
    title: "Transfer Globe",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Transfer Globe",
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
