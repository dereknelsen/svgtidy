import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const fontSans = localFont({
  src: "./fonts/AtkinsonHyperlegibleNextVF-Variable.woff2",
  variable: "--font-sans",
  weight: "200 800",
  display: "swap",
});

const fontMono = localFont({
  src: "./fonts/AtkinsonHyperlegibleMonoVF-Variable.woff2",
  variable: "--font-mono",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://svgtidy.com"),
  title: "SVGtidy — SVG optimizer",
  description:
    "A fast, local-first SVG optimizer. Drop files, tune settings, and export smaller SVGs. Nothing leaves your browser.",
  applicationName: "SVGtidy",
  keywords: ["svg", "svgo", "optimizer", "minify", "vector", "compress"],
  openGraph: {
    title: "SVGtidy — SVG optimizer",
    description:
      "A fast, local-first SVG optimizer. Drop files, tune settings, and export smaller SVGs. Nothing leaves your browser.",
    url: "https://svgtidy.com",
    siteName: "SVGtidy",
  },
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
      </body>
    </html>
  );
}
