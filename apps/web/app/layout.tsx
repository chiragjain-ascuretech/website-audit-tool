import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Website Audit Tool",
  description: "Comprehensive SEO + performance + JS error audits.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

