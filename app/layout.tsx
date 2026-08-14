import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Vector — SVG optimizer",
  description:
    "A fast, local-first SVG optimizer. Drop files, tune settings, and export smaller SVGs. Nothing leaves your browser.",
  applicationName: "Vector",
  keywords: ["svg", "svgo", "optimizer", "minify", "vector", "compress"],
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
      className={`${fontSans.variable} ${fontMono.variable} bg-background`}
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
