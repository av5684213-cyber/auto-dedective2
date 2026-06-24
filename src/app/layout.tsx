import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Otodedektif - Tüm İkinci El Araç İlanları Tek Bir Adreste",
  description: "Tüm ikinci el araç platformlarını tek aramada karşılaştırın. En iyi fırsatları bulun, fiyat analizi yapın.",
  keywords: ["ikinci el", "araç", "otomobil", "kıyasla", "fiyat", "sahibinden", "arabam", "meta-arama"],
  authors: [{ name: "Otodedektif" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-icon.svg",
  },
  openGraph: {
    title: "Otodedektif",
    description: "Tüm İkinci El Araç İlanları Tek Bir Adreste",
    type: "website",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
