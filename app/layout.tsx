import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/providers";
import LayoutClient from "@/components/LayoutClient";

export const metadata: Metadata = {
  title: "MAN NO BE GOD COMPANY LIMITED",
  description: "Offline desktop application for managing stock cards - MAN NO BE GOD COMPANY LIMITED",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProvider>
          <LayoutClient>{children}</LayoutClient>
        </AppProvider>
      </body>
    </html>
  );
}
