import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";

const playfair = localFont({
  src: "./fonts/Playfair-variable.woff2",
  variable: "--font-pd",
  weight: "400 900",
  style: "normal",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

const jetbrains = localFont({
  src: "./fonts/JetBrainsMono-variable.woff2",
  variable: "--font-jb",
  weight: "100 800",
  style: "normal",
  display: "swap",
});

const amiri = localFont({
  src: [
    { path: "./fonts/Amiri-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Amiri-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dema — BIZRA Node0",
  description:
    "Dema is the face of your BIZRA node. She does not replace you and does not decide for you. She helps you see meanings, choose consciously, act with consent, and preserve proof — behind her stands your private PAT-7 council.",
  keywords: [
    "BIZRA",
    "Dema",
    "Node0",
    "Sovereign Proofworld",
    "proof-of-truth",
    "consent gates",
    "human sovereignty",
  ],
  authors: [{ name: "BIZRA Dema" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${inter.variable} ${jetbrains.variable} ${amiri.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
        <Sonner
          position="bottom-right"
          theme="dark"
          toastOptions={{
            classNames: {
              toast: "glass-strong border border-border rounded-lg",
            },
          }}
        />
      </body>
    </html>
  );
}
