import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
import { cn } from "@/lib/utils";

const fontSans = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-family-sans",
  weight: "200 800",
  display: "swap",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-family-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://svgtidy.com"),
  title: "SVGtidy | SVG optimizer and exporter",
  description:
    "Local-first SVG optimizer and exporter. Drop files, tune settings, and export smaller SVGs, WebP, Avif, PNG and favicon files.",
  applicationName: "SVGtidy",
  keywords: ["svg", "svgo", "optimizer", "minify", "vector", "compress", "webp", "avif", "png", "favicon"],
  openGraph: {
    title: "SVGtidy SVG optimizer",
    description:
      "Local-first SVG optimizer and exporter. Drop files, tune settings, and export smaller SVGs, WebP, Avif, PNG and favicon files.",
    url: "https://svgtidy.com",
    siteName: "SVGtidy",
  },
  // icons: {
  //   icon: [
  //     {
  //       url: "/icon-light.svg",
  //       media: "(prefers-color-scheme: light)",
  //     },
  //     {
  //       url: "/icon-dark.svg",
  //       media: "(prefers-color-scheme: dark)",
  //     },
  //   ],
  // },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "bg-background",
        fontSans.variable,
        fontMono.variable,
        "font-sans",
      )}
    >
      <body className="antialiased">
        <ThemeProvider>
          <Suspense fallback={null}>
            <NuqsAdapter>{children}</NuqsAdapter>
          </Suspense>
          <Toaster position="bottom-right" />
        </ThemeProvider>

        {/* Umami analytics */}
        {process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL && process.env.NEXT_PUBLIC_GUESTBOOK_DOMAIN && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL} data-do-not-track="true" data-exclude-search="true" data-domains={process.env.NEXT_PUBLIC_GUESTBOOK_DOMAIN} data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID} strategy="afterInteractive" />
        )}
      </body>
    </html>
  );
}
