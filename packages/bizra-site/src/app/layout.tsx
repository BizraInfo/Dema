import type { Metadata } from "next";
import "./globals.css";

// Offline-buildable: next/font/google fetches at build time, which fails with
// no network. Font variables now live in globals.css as system stacks.
export const metadata: Metadata = {
  title: "BIZRA · البذرة — an AI node that runs on your own machine",
  description:
    "The BIZRA APEX KERNEL: one board, eleven movements — the living loop, the forest to a million nodes, and the omni-synthesis audit (Ihsān gate, PoI economics, BlockTree scaling). Design sealed · Node0 seed runtime.",
  keywords: ["BIZRA", "URP", "PAT", "FATE", "BlockTree", "PoI", "Ihsān", "APEX KERNEL"],
  authors: [{ name: "BIZRA · MoMo Think Tank + Task Force" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "BIZRA · البذرة — an AI node that runs on your own machine",
    description: "The living loop, the forest to a million, and the omni-synthesis audit. Design sealed · Node0 seed runtime.",
    siteName: "BIZRA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BIZRA vΩ.2.0 — APEX KERNEL",
    description: "The living loop, the forest to a million, and the omni-synthesis audit.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
