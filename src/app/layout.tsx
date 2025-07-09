// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import SidebarLayout from "@/components/SidebarLayout";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "TCG Shipping Suite",
  description: "Label generation and batch management for TCGplayer sellers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SidebarLayout>{children}</SidebarLayout>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
