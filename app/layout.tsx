import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScrimForge V5",
  description: "Competitive scrims and tournament management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
