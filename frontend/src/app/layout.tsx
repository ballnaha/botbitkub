import type { Metadata } from "next";
import { Sarabun, Outfit, Fira_Code } from "next/font/google";
import "./globals.css";
import ThemeRegistry from "./ThemeRegistry";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "block", // Hide text until font is ready
  variable: "--font-sarabun",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "block",
  variable: "--font-outfit",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "block",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Bitkub API Hub - Developer Trading Terminal",
  description: "Professional developer trading dashboard and auto trading bot proxy for Bitkub API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`h-full antialiased ${sarabun.variable} ${outfit.variable} ${firaCode.variable}`}>
      <body className={`min-h-full flex flex-col bg-[#080b11] text-slate-100 ${sarabun.className}`}>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
