import type { Metadata } from "next";
import "./globals.css";
import Providers from "../components/Providers";

export const metadata: Metadata = {
  title: "AegisDesk - AI-Powered Incident Command",
  description: "Resolve incidents 10× faster with AI agents. Powered by PowerSync for offline-first operations.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
