import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Otodedektif - Türkiye'nin İkinci El Araç Meta-Arama Platformu",
  description: "Tüm ikinci el araç platformlarını tek aramada karşılaştırın. En iyi fırsatları bulun, fiyat analizi yapın.",
  keywords: ["ikinci el", "araç", "otomobil", "kıyasla", "fiyat", "sahibinden", "arabam", "meta-arama"],
  authors: [{ name: "Otodedektif" }],
  openGraph: {
    title: "Otodedektif",
    description: "Türkiye'nin İkinci El Araç Meta-Arama Platformu",
    type: "website",
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
