import type { Metadata } from "next";
import { Syne, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Otodedektif - Tüm İkinci El Araç İlanları Tek Bir Adreste",
  description: "Tüm ikinci el araç platformlarını tek aramada karşılaştırın. En iyi fırsatları bulun, fiyat analizi yapın.",
  keywords: ["ikinci el", "araç", "otomobil", "kıyasla", "fiyat", "sahibinden", "arabam", "meta-arama"],
  authors: [{ name: "Otodedektif" }],
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
  manifest: "/manifest.json",
  themeColor: "#ea580c",
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
    <html lang="tr" suppressHydrationWarning className="dark">
      <body
        className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
